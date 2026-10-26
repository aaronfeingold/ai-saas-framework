import { streamText } from 'ai';
import type { ResolvedPrompt } from '../prompts.js';
import { traceLabels } from '../skills.js';
import type { BaseCtx, StoredMessage } from '../types.js';
import { type TurnDeps, textOf, tokensOf } from './run-turn.js';

/** Used when an agent does not name its own summary prompt. */
export const DEFAULT_SUMMARY_INSTRUCTIONS = `You keep a running summary of a conversation between a person and an assistant, so the assistant can pick up where they left off. Write at most 300 words of plain prose. Keep: what the person wants, what was suggested and how they reacted, preferences and facts they stated, and anything left unresolved. Leave out pleasantries. Write only the summary.`;

const transcript = (messages: StoredMessage[]) =>
  messages
    .map((m) => `${m.role === 'user' ? 'Person' : 'Assistant'}: ${textOf(m)}`)
    .filter((line) => !line.endsWith(': '))
    .join('\n');

/**
 * Fold messages that no longer fit the context budget into the session's rolling summary.
 * Runs after the reply has been sent and never throws: a failed summary only means the next
 * turn tries again.
 */
export async function summarizeIfNeeded<C extends BaseCtx>(
  deps: TurnDeps<C>,
  ctx: C,
  sessionId: string,
): Promise<void> {
  try {
    const { store } = deps.agent;
    const window = await store.getContextWindow(ctx, sessionId, deps.settings.contextTokenBudget);
    const last = window.overflow.at(-1);
    if (!last) return;

    const prompt: ResolvedPrompt = deps.agent.summaryPromptName
      ? await deps.settings.prompts.get(deps.agent.summaryPromptName)
      : {
          name: 'default-summary',
          text: DEFAULT_SUMMARY_INSTRUCTIONS,
          version: 'builtin',
          source: 'file',
        };
    const labels = traceLabels('step/summarise', prompt, []);
    const result = streamText({
      model: deps.resolveModel(deps.settings.summaryModel),
      instructions: prompt.text,
      runtimeContext: labels.runtimeContext,
      prompt: [
        window.summary ? `Summary so far:\n${window.summary}` : 'There is no summary yet.',
        `New messages to fold in:\n${transcript(window.overflow)}`,
      ].join('\n\n'),
      maxOutputTokens: 600,
      abortSignal: AbortSignal.timeout(60_000),
      telemetry: {
        functionId: 'chat-summary',
        recordInputs: deps.settings.recordContent,
        recordOutputs: deps.settings.recordContent,
        includeRuntimeContext: labels.include,
      },
    });
    const [summary, usage] = await Promise.all([result.text, result.usage]);
    await store.recordUsage(ctx, {
      sessionId,
      model: deps.settings.summaryModel,
      purpose: 'summary',
      agent: 'step/summarise',
      payer: 'user',
      tokens: tokensOf(usage),
    });
    if (summary.trim()) await store.updateSummary(ctx, sessionId, summary.trim(), last.id);
  } catch (err) {
    ctx.logger.warn({ err, sessionId }, 'could not summarise session');
  }
}
