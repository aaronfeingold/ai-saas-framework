import { generateText, isStepCount, type ModelMessage } from 'ai';
import { AppError } from '../errors.js';
import type { ModelResolver } from '../models.js';
import { buildTools } from '../operations/tools.js';
import { assembleInstructions, resolveSkills, traceLabels } from '../skills.js';
import type { Metrics } from '../telemetry/metrics.js';
import { tokensOf } from '../turn/run-turn.js';
import type { AgentDefinition, BaseCtx, TurnSettings } from '../types.js';

/** Limits on one run. All three are enforced here, in code, never left to the model. */
export type AgentBudget = {
  /** Model calls. */
  maxSteps: number;
  /** Wall time for the whole run. */
  timeoutMs: number;
  /** The run stops after the step that takes recorded spend to or past this. */
  maxCostMicroUsd: bigint;
};

export type AgentRunResult = {
  /** `partial`: a budget or the caller stopped it; `text` and what its tools saved still stand. */
  status: 'complete' | 'partial' | 'failed';
  stoppedBy?: 'steps' | 'time' | 'spend' | 'abort';
  /** The last text the agent wrote. */
  text: string;
  /** Model calls that finished. */
  steps: number;
  costMicroUsd: bigint;
  toolCalls: Array<{ tool: string; failed: boolean }>;
};

export type AgentRunInput = {
  /** What the agent is asked to do. */
  task: string;
  /** `provider:model-id`. */
  model: string;
  budget: AgentBudget;
  /** Whose allowance the run is charged to. */
  payer: 'user' | 'library';
  abortSignal?: AbortSignal;
};

export type AgentRunDeps<C extends BaseCtx> = {
  agent: AgentDefinition<C>;
  settings: TurnSettings;
  resolveModel: ModelResolver;
  metrics?: Metrics;
};

/**
 * Run an agent to completion with no person on the other end: the same tool loop as a chat
 * turn, without a conversation or a stream. This is how one agent hands work to another:
 * a tool's handler calls this and returns the result.
 *
 * It never throws for something that went wrong during the run (that is `failed`, with
 * whatever was produced before). It throws only when asked to start from inside another
 * sub-agent: depth is one.
 */
export async function runAgent<C extends BaseCtx>(
  deps: AgentRunDeps<C>,
  ctx: C,
  input: AgentRunInput,
): Promise<AgentRunResult> {
  if ((ctx.agentDepth ?? 0) >= 1) {
    throw new AppError('agent_depth_exceeded', 500, 'A sub-agent cannot start another agent');
  }
  const { agent, settings, metrics } = deps;
  const { budget } = input;
  const runCtx = { ...ctx, agentDepth: 1 };
  const log = ctx.logger.child({ agent: agent.id });

  const result: AgentRunResult = {
    status: 'complete',
    text: '',
    steps: 0,
    costMicroUsd: 0n,
    toolCalls: [],
  };
  const stop = (status: 'partial' | 'failed', stoppedBy?: AgentRunResult['stoppedBy']) => ({
    ...result,
    status,
    ...(stoppedBy ? { stoppedBy } : {}),
  });

  const timeout = AbortSignal.timeout(budget.timeoutMs);
  const abortSignal = input.abortSignal ? AbortSignal.any([input.abortSignal, timeout]) : timeout;
  const interrupted = (): AgentRunResult['stoppedBy'] | undefined =>
    input.abortSignal?.aborted ? 'abort' : timeout.aborted ? 'time' : undefined;
  // A model call includes running the tools it asked for, and a tool may be slow or stuck.
  // The run returns at the deadline regardless; the tool is told through its own signal and
  // whatever it was doing is left to finish or give up by itself.
  const cut = new Promise<never>((_, reject) => {
    const fire = () => reject(new DOMException('The run was cut short', 'AbortError'));
    if (abortSignal.aborted) fire();
    else abortSignal.addEventListener('abort', fire, { once: true });
  });
  cut.catch(() => {});
  const untilCut = <T>(work: Promise<T>): Promise<T> => {
    work.catch(() => {});
    return Promise.race([work, cut]);
  };

  try {
    const [core, skills, context] = await Promise.all([
      settings.prompts.get(agent.corePromptName),
      resolveSkills(agent.skills ?? [], runCtx, settings.prompts),
      agent.buildContext?.(runCtx, { onMemoryUnavailable: () => metrics?.memoryDegraded() }) ?? [],
    ]);
    const instructions = assembleInstructions({ core: core.text, skills, context, summary: null });
    const tools = buildTools(
      agent.operations,
      runCtx,
      { agentId: agent.id, activeSkillIds: skills.map((s) => s.id) },
      (tool, failed) => {
        result.toolCalls.push({ tool, failed });
        metrics?.toolCall(tool, failed);
      },
    );
    const model = deps.resolveModel(input.model);
    const labels = traceLabels(agent.id, core, skills, { payer: input.payer });
    const messages: ModelMessage[] = [{ role: 'user', content: input.task }];

    // One model call per pass, so every limit is checked between calls with the real cost
    // of the last one in hand.
    while (true) {
      const stopped = interrupted();
      if (stopped) return stop('partial', stopped);
      if (result.steps >= budget.maxSteps) return stop('partial', 'steps');
      if (result.costMicroUsd >= budget.maxCostMicroUsd) return stop('partial', 'spend');

      const step = await untilCut(
        generateText({
          model,
          instructions,
          messages,
          tools,
          stopWhen: isStepCount(1),
          maxOutputTokens: settings.maxOutputTokens,
          abortSignal,
          telemetry: {
            functionId: `agent/${agent.id}`,
            recordInputs: settings.recordContent,
            recordOutputs: settings.recordContent,
            includeRuntimeContext: labels.include,
          },
          runtimeContext: labels.runtimeContext,
        }),
      );

      result.steps += 1;
      if (step.text.trim()) result.text = step.text.trim();
      const tokens = tokensOf(step.usage);
      const event = await agent.store.recordUsage(ctx, {
        sessionId: ctx.sessionId ?? null,
        model: input.model,
        purpose: 'agent',
        agent: agent.id,
        payer: input.payer,
        tokens,
      });
      result.costMicroUsd += event.costMicroUsd;
      metrics?.modelUsage(input.model, tokens, event.costMicroUsd);

      if (step.finishReason !== 'tool-calls') return result;
      messages.push(...step.response.messages);
    }
  } catch (err) {
    const stopped = interrupted();
    if (stopped) return stop('partial', stopped);
    log.error({ err }, 'agent run failed');
    return stop('failed');
  }
}
