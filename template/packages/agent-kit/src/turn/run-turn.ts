import {
  isStepCount,
  type LanguageModelUsage,
  type ModelMessage,
  NoSuchToolError,
  smoothStream,
  streamText,
  toUIMessageStream,
  type UIMessageChunk,
} from 'ai';
import type { ModelResolver } from '../models.js';
import { buildTools } from '../operations/tools.js';
import { assembleInstructions, resolveSkills, traceLabels } from '../skills.js';
import type { Metrics } from '../telemetry/metrics.js';
import type {
  AgentDefinition,
  BaseCtx,
  MessageStatus,
  StoredMessage,
  TokenUsage,
  TurnGate,
  TurnReport,
  TurnSettings,
} from '../types.js';
import { summarizeIfNeeded } from './summarize.js';

export type TurnDeps<C extends BaseCtx> = {
  agent: AgentDefinition<C>;
  settings: TurnSettings;
  resolveModel: ModelResolver;
  /** Delay between smoothed text chunks; null turns smoothing off (tests). */
  smoothDelayMs?: number | null;
  metrics?: Metrics;
};

export type TurnOutcome = { status: MessageStatus; assistantMessageId: string };

export type TurnInput = {
  sessionId: string;
  /** From `checkBudget`: which model to use and how many steps it may take. */
  budget: { model: string; maxSteps: number };
  /** Aborting cancels the model call; the partial reply is saved as stopped. */
  abortSignal?: AbortSignal;
  /** Runs after the reply is saved and before the stream closes, e.g. to release a lock. */
  onDone?: (outcome: TurnOutcome) => Promise<void> | void;
};

export type Turn = {
  /** UI message chunks for the client. Safe to cancel: the turn still finishes and is saved. */
  stream: ReadableStream<UIMessageChunk>;
  /** Resolves once the assistant message and usage are stored. */
  done: Promise<TurnOutcome>;
  /** Resolves after any follow-up summarisation. Never rejects. */
  settled: Promise<void>;
};

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const TOOL_UNAVAILABLE = 'That tool is not available right now.';

/** The plain text of a stored message, ignoring tool and reasoning parts. */
export function textOf(message: StoredMessage): string {
  return message.parts
    .map((part) =>
      part && typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part
        ? String(part.text)
        : '',
    )
    .join('')
    .trim();
}

export function tokensOf(usage: LanguageModelUsage): TokenUsage {
  const cachedInput = usage.inputTokenDetails?.cacheReadTokens ?? 0;
  return {
    input: Math.max(0, (usage.inputTokens ?? 0) - cachedInput),
    cachedInput,
    output: usage.outputTokens ?? 0,
  };
}

/**
 * Earlier turns go to the model as text only. Tool payloads from past turns are dropped:
 * the answers that came out of them are in the text, and resending them every turn would
 * multiply input cost.
 */
function toModelMessages(history: StoredMessage[]): ModelMessage[] {
  return history
    .map((m) => ({ role: m.role, content: textOf(m) }))
    .filter((m) => m.content.length > 0);
}

/**
 * Run one assistant turn for a session whose latest stored message is the user's.
 *
 * The turn is driven to completion here regardless of whether anyone reads `stream`, so a
 * dropped connection never loses a reply. The assistant message is stored as `complete`,
 * `stopped` (aborted) or `failed` (the model errored), and each model step's usage is
 * recorded against the user.
 */
export async function runTurn<C extends BaseCtx>(
  deps: TurnDeps<C>,
  ctx: C,
  input: TurnInput,
): Promise<Turn> {
  const { settings } = deps;
  const { store } = deps.agent;
  const window = await store.getContextWindow(ctx, input.sessionId, settings.contextTokenBudget);
  const { metrics } = deps;
  const startedAt = performance.now();
  // Instructions and tools are told which chat they are serving, so a tool such as "read
  // this table's wine list" needs no argument from the model.
  const turnCtx: C = { ...ctx, sessionId: input.sessionId };
  const log = ctx.logger.child({ sessionId: input.sessionId });

  const turnOf = { sessionId: input.sessionId, recent: window.recent };
  const gateFrom = async (hook: AgentDefinition<C>['beforeTurn'], name: string) => {
    if (!hook) return {};
    try {
      return await hook(turnCtx, turnOf);
    } catch (err) {
      log.error({ err }, `${name} failed; continuing without it`);
      return {};
    }
  };

  // The agent's own gate: it may answer the turn outright, or add to it.
  const first: TurnGate = await gateFrom(deps.agent.beforeTurn, 'beforeTurn');
  if (first.reply !== undefined) return gatedTurn(deps, ctx, input, first.reply);

  let failed = false;
  /** Set when the reply guard ended the reply early: the text to store in its place. */
  let cut: string | undefined;
  const usageWrites: Promise<unknown>[] = [];
  const history = toModelMessages(window.recent);
  /** Characters streamed since the last step whose real usage was recorded. */
  let unbilledChars = 0;

  // A provider call that never returns must not hold the session and the stream slot forever.
  const timeout = AbortSignal.timeout(settings.turnTimeoutMs);

  const charge = (tokens: TokenUsage) =>
    store
      .recordUsage(ctx, {
        sessionId: input.sessionId,
        model: input.budget.model,
        purpose: 'chat',
        agent: deps.agent.id,
        payer: 'user',
        tokens,
      })
      .then((event) => metrics?.modelUsage(input.budget.model, tokens, event.costMicroUsd))
      .catch((err) => log.error({ err }, 'could not record usage'));

  // The context may be built twice in a turn (once on a guess); a missing memory counts once.
  let memoryMissed = false;
  const hooks = {
    onMemoryUnavailable: () => {
      if (!memoryMissed) metrics?.memoryDegraded();
      memoryMissed = true;
    },
  };
  /** Everything a model call is made from, for one view of the gate. */
  const prepare = async (gate: TurnGate) => {
    const callCtx: C = gate.signals ? { ...turnCtx, signals: gate.signals } : turnCtx;
    const [core, skills, context] = await Promise.all([
      settings.prompts.get(deps.agent.corePromptName),
      resolveSkills(deps.agent.skills ?? [], callCtx, settings.prompts),
      deps.agent.buildContext?.(callCtx, hooks) ?? [],
    ]);
    return {
      ctx: callCtx,
      core,
      skills,
      instructions: assembleInstructions({
        core: core.text,
        skills,
        context: [...context, ...(gate.instructions ?? [])],
        summary: window.summary,
      }),
      maxOutputTokens: gate.maxOutputTokens ?? settings.maxOutputTokens,
    };
  };
  type Prepared = Awaited<ReturnType<typeof prepare>>;
  type Attempt = Prepared & {
    result: ReturnType<typeof streamText>;
    /** Fired by the reply guard to cut a reply, or to drop this call for another. */
    stop: AbortController;
    /** Dropped in favour of another call: nothing it does counts any more. */
    abandoned: boolean;
    /** A step of it finished and was charged at its real usage. */
    charged: boolean;
  };
  /** The model call whose reply this turn will use. */
  let current: Attempt | undefined;

  /**
   * Start the model. `mayRunTools`, when given, is awaited before any tool runs, so a call
   * started on a guess cannot change anything until the guess is confirmed.
   */
  const launch = (prep: Prepared, mayRunTools?: () => Promise<boolean>): Attempt => {
    const stop = new AbortController();
    const scope = { agentId: deps.agent.id, activeSkillIds: prep.skills.map((s) => s.id) };
    // Which agent, skills and exact prompt versions produced this turn.
    const labels = traceLabels(deps.agent.id, prep.core, prep.skills);
    const tools = buildTools(deps.agent.operations, prep.ctx, scope, (tool, toolFailed) =>
      metrics?.toolCall(tool, toolFailed),
    );
    if (mayRunTools) {
      for (const t of Object.values(tools)) {
        const run = t.execute;
        if (!run) continue;
        t.execute = async (...args: Parameters<typeof run>) =>
          (await mayRunTools())
            ? run(...args)
            : { error: { code: 'turn_restarted', message: 'This call was dropped.' } };
      }
    }
    const attempt = { ...prep, stop, abandoned: false, charged: false } as Attempt;
    attempt.result = streamText({
      model: deps.resolveModel(input.budget.model),
      instructions: prep.instructions,
      messages: history,
      tools,
      // Prompts and replies are attached to spans only when explicitly switched on.
      telemetry: {
        functionId: 'chat-turn',
        recordInputs: settings.recordContent,
        recordOutputs: settings.recordContent,
        includeRuntimeContext: labels.include,
      },
      runtimeContext: labels.runtimeContext,
      stopWhen: isStepCount(input.budget.maxSteps),
      maxOutputTokens: prep.maxOutputTokens,
      abortSignal: AbortSignal.any(
        [input.abortSignal, timeout, stop.signal].filter((x): x is AbortSignal => Boolean(x)),
      ),
      reasoning: settings.reasoningEffort,
      providerOptions: settings.reasoningEffort
        ? { openai: { reasoningSummary: 'auto' } }
        : undefined,
      experimental_transform:
        deps.smoothDelayMs === null
          ? undefined
          : smoothStream({ delayInMs: deps.smoothDelayMs ?? 10, chunking: 'word' }),
      onStepEnd: (step) => {
        const tokens = tokensOf(step.usage);
        // A step that ended in an error reports no usage; leave it to the estimate below.
        if (tokens.input + tokens.cachedInput + tokens.output === 0) return;
        attempt.charged = true;
        if (current === attempt) unbilledChars = 0;
        usageWrites.push(charge(tokens));
      },
      onError: ({ error }) => {
        // Stopping the model on purpose is not a failure.
        if (attempt.abandoned || cut !== undefined) return;
        failed = true;
        log.error({ err: error }, 'model call failed');
      },
    });
    return attempt;
  };

  /** Drop a call started on a guess. The provider still bills what it was sent. */
  const abandon = (attempt: Attempt) => {
    attempt.abandoned = true;
    attempt.stop.abort();
    if (!attempt.charged) {
      const promptChars =
        attempt.instructions.length + history.reduce((n, m) => n + String(m.content).length, 0);
      usageWrites.push(charge({ input: Math.ceil(promptChars / 4), cachedInput: 0, output: 0 }));
    }
  };

  const alongside = deps.agent.whileStarting;
  if (!alongside) {
    current = launch(await prepare(first));
  } else {
    // The slower part of the gate runs while the model is already working on the likeliest
    // case (the message is fine as it is). Nothing of that call is shown, and none of its
    // tools run, until the gate has spoken.
    const verdict = gateFrom(alongside, 'whileStarting');
    let decide!: (keep: boolean) => void;
    const kept = new Promise<boolean>((resolve) => {
      decide = resolve;
    });
    const guess: Attempt = launch(await prepare(first), () => kept);
    const second = await verdict;
    if (second.reply !== undefined) {
      decide(false);
      abandon(guess);
      await Promise.all(usageWrites);
      return gatedTurn(deps, ctx, input, second.reply);
    }
    const gate: TurnGate = {
      ...first,
      ...second,
      instructions: [...(first.instructions ?? []), ...(second.instructions ?? [])],
      signals: { ...first.signals, ...second.signals },
    };
    const wanted = await prepare(gate);
    if (
      wanted.instructions === guess.instructions &&
      wanted.maxOutputTokens === guess.maxOutputTokens &&
      wanted.skills.map((x) => x.id).join() === guess.skills.map((x) => x.id).join()
    ) {
      // The guess was right: its reply is the reply.
      guess.ctx = wanted.ctx;
      current = guess;
      decide(true);
    } else {
      decide(false);
      abandon(guess);
      current = launch(wanted);
    }
  }
  const chosen = current;
  const { result, instructions } = chosen;
  const guardStop = chosen.stop;

  let reply: { parts: unknown[]; aborted: boolean } | undefined;
  const ui = toUIMessageStream({
    stream: result.stream,
    sendReasoning: true,
    onError: (error) => {
      // The model asked for a tool it was not offered this turn (it may have seen the name
      // earlier in the conversation). The SDK reports that back to the model, which carries
      // on; this is the text attached to the failed call.
      // It arrives once as the error and once already turned into text.
      if (NoSuchToolError.isInstance(error) || String(error).startsWith('AI_NoSuchToolError')) {
        return TOOL_UNAVAILABLE;
      }
      return settings.exposeErrorDetail && error instanceof Error
        ? `The model call failed: ${error.message}`
        : GENERIC_ERROR;
    },
    onEnd: ({ responseMessage, isAborted }) => {
      reply = { parts: responseMessage.parts, aborted: isAborted };
    },
  });

  let resolveDone!: (outcome: TurnOutcome) => void;
  let rejectDone!: (err: unknown) => void;
  const done = new Promise<TurnOutcome>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });
  let resolveSettled!: () => void;
  const settled = new Promise<void>((resolve) => {
    resolveSettled = resolve;
  });

  let readerGone = false;
  const stream = new ReadableStream<UIMessageChunk>({
    start(controller) {
      const forward = (chunk: UIMessageChunk) => {
        if (readerGone) return;
        try {
          controller.enqueue(chunk);
        } catch {
          readerGone = true;
        }
      };

      void (async () => {
        let report: TurnReport | undefined;
        let sawText = false;
        /** The reply's text so far, for the guard, and how much of it has been sent on. */
        let shown = '';
        let released = 0;
        try {
          for await (const chunk of ui) {
            if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') {
              unbilledChars += chunk.delta.length;
            }
            if (!sawText && chunk.type === 'text-delta') {
              sawText = true;
              metrics?.chatFirstToken(performance.now() - startedAt);
            }
            const guard = deps.agent.replyGuard;
            if (!guard || (chunk.type !== 'text-delta' && chunk.type !== 'text-end')) {
              // A new piece of text starts on its own line as far as the guard is concerned.
              if (chunk.type === 'text-start' && shown) {
                shown += '\n\n';
                released = shown.length;
              }
              forward(chunk);
              continue;
            }

            // The guard sees new text before the person does, and decides how much of it
            // may go out now.
            const final = chunk.type === 'text-end';
            if (chunk.type === 'text-delta') shown += chunk.delta;
            const verdict = guard(shown, final);
            if (verdict && 'cutAt' in verdict) {
              // The reply cannot end before text that has already been shown, and what is
              // stored must be exactly what the person saw.
              const sent = shown.slice(0, released);
              const kept = shown.slice(0, Math.max(verdict.cutAt, released)).trimEnd();
              const join = (before: string) =>
                before && verdict.append
                  ? `${before}\n\n${verdict.append}`
                  : before || verdict.append;
              cut = join(kept).startsWith(sent) ? join(kept) : join(sent);
              guardStop.abort();
              if (cut.length > released) {
                forward({ type: 'text-delta', id: chunk.id, delta: cut.slice(released) });
              }
              forward({ type: 'text-end', id: chunk.id });
              forward({ type: 'finish-step' });
              forward({ type: 'finish' });
              break;
            }
            const upTo = final
              ? shown.length
              : Math.max(released, verdict?.holdFrom ?? shown.length);
            if (upTo > released) {
              forward({ type: 'text-delta', id: chunk.id, delta: shown.slice(released, upTo) });
              released = upTo;
            }
            if (final) forward(chunk);
          }
        } catch (err) {
          if (cut === undefined) {
            failed = true;
            log.error({ err }, 'turn stream failed');
            forward({ type: 'error', errorText: GENERIC_ERROR });
          }
        }

        try {
          const stopped = input.abortSignal?.aborted === true;
          // Running out of time is a failure; only the person's own stop is "stopped".
          if (timeout.aborted && !stopped) failed = true;
          const status: MessageStatus = failed
            ? 'failed'
            : cut !== undefined
              ? 'complete'
              : stopped || reply?.aborted
                ? 'stopped'
                : 'complete';
          // A step cut short reports no usage, but the provider still bills for what it
          // read and wrote. Charge an estimate so Stop cannot be used to chat for free.
          if ((status !== 'complete' || cut !== undefined) && unbilledChars > 0) {
            const promptChars =
              instructions.length + history.reduce((n, m) => n + String(m.content).length, 0);
            usageWrites.push(
              charge({
                input: Math.ceil(promptChars / 4),
                cachedInput: 0,
                output: Math.ceil(unbilledChars / 4),
              }),
            );
          }
          // A cut reply keeps what else happened in the turn (tool calls and their results)
          // and replaces all of its text with what the person was actually shown.
          const parts =
            cut !== undefined
              ? [...(reply?.parts ?? []).filter((p) => !isTextPart(p)), { type: 'text', text: cut }]
              : (reply?.parts ?? []);
          const saved = await store.appendMessage(ctx, input.sessionId, {
            role: 'assistant',
            parts,
            status,
          });
          await Promise.all(usageWrites);
          const outcome = { status, assistantMessageId: saved.id };
          await input.onDone?.(outcome);
          resolveDone(outcome);
          report = {
            sessionId: input.sessionId,
            status,
            replyText: textOf(saved),
            toolOutputs: toolOutputsOf(parts),
            gated: false,
            cut: cut !== undefined,
          };
        } catch (err) {
          log.error({ err }, 'could not save turn');
          rejectDone(err);
        }

        if (!readerGone) {
          try {
            controller.close();
          } catch {
            // The reader cancelled while we were saving.
          }
        }
        // Tell the agent what happened, then summarise; neither may disturb the turn.
        afterTurn(deps, chosen.ctx, report, log)
          .then(() => summarizeIfNeeded(deps, ctx, input.sessionId))
          .finally(resolveSettled);
      })();
    },
    cancel() {
      readerGone = true;
    },
  });

  // Callers that only await `settled` should not trip an unhandled rejection.
  done.catch(() => {});
  return { stream, done, settled };
}

const isTextPart = (part: unknown) =>
  typeof part === 'object' && part !== null && 'type' in part && part.type === 'text';

/** The output of each tool that ran, read from a reply's parts. */
function toolOutputsOf(parts: unknown[]): unknown[] {
  return parts.flatMap((part) =>
    part && typeof part === 'object' && 'output' in part && part.output !== undefined
      ? [part.output]
      : [],
  );
}

async function afterTurn<C extends BaseCtx>(
  deps: TurnDeps<C>,
  ctx: C,
  report: TurnReport | undefined,
  log: C['logger'],
): Promise<void> {
  if (!report || !deps.agent.afterTurn) return;
  try {
    await deps.agent.afterTurn(ctx, report);
  } catch (err) {
    log.error({ err }, 'afterTurn failed');
  }
}

/**
 * A turn the agent answered itself, before any model call: the text is streamed and stored
 * exactly as a model's reply would be, and nothing is spent.
 */
async function gatedTurn<C extends BaseCtx>(
  deps: TurnDeps<C>,
  ctx: C,
  input: TurnInput,
  text: string,
): Promise<Turn> {
  const log = ctx.logger.child({ sessionId: input.sessionId });
  const saved = await deps.agent.store.appendMessage(ctx, input.sessionId, {
    role: 'assistant',
    parts: [{ type: 'text', text }],
    status: 'complete',
  });
  const outcome: TurnOutcome = { status: 'complete', assistantMessageId: saved.id };
  await input.onDone?.(outcome);

  const id = 'gate';
  const chunks: UIMessageChunk[] = [
    { type: 'start' },
    { type: 'start-step' },
    { type: 'text-start', id },
    { type: 'text-delta', id, delta: text },
    { type: 'text-end', id },
    { type: 'finish-step' },
    { type: 'finish' },
  ];
  const stream = new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  const settled = afterTurn(
    deps,
    { ...ctx, sessionId: input.sessionId },
    {
      sessionId: input.sessionId,
      status: 'complete',
      replyText: text,
      toolOutputs: [],
      gated: true,
      cut: false,
    },
    log,
  );
  return { stream, done: Promise.resolve(outcome), settled };
}
