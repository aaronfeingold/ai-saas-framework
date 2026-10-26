import { MockLanguageModelV4 } from 'ai/test';
import pino from 'pino';
import type {
  AgentStore,
  BaseCtx,
  StoredMessage,
  TurnSettings,
  UsageRecord,
} from '../../src/index.js';
import { memoryPrompts } from './prompts.js';

export type Ctx = BaseCtx;
export const logger = pino({ level: 'silent' });
export const ctx: Ctx = { userId: 'ann', logger };

/** One conversation held in memory, enough to run turns against. */
export function memoryConversation() {
  const messages: StoredMessage[] = [];
  const usage: UsageRecord[] = [];
  const store = {
    getContextWindow: async () => ({ summary: null, recent: [...messages], overflow: [] }),
    appendMessage: async (
      _c: Ctx,
      _id: string,
      m: Parameters<AgentStore<Ctx>['appendMessage']>[2],
    ) => {
      const stored: StoredMessage = {
        id: `m${messages.length + 1}`,
        role: m.role,
        parts: m.parts,
        status: m.status ?? 'complete',
        clientMessageId: m.clientMessageId ?? null,
        createdAt: new Date().toISOString(),
      };
      messages.push(stored);
      return stored;
    },
    updateSummary: async () => {},
    recordUsage: async (_c: Ctx, record: UsageRecord) => {
      usage.push(record);
      return { costMicroUsd: 1n };
    },
  } as unknown as AgentStore<Ctx>;
  const say = (text: string) =>
    store.appendMessage(ctx, 's1', { role: 'user', parts: [{ type: 'text', text }] });
  return { store, messages, usage, say };
}

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
export type Step = { text?: string | string[]; tool?: { name: string; input: unknown } };

/** A streaming model that answers each call with the next step; text may arrive in pieces. */
export function scripted(steps: Step[]) {
  let call = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      const step = steps[Math.min(call++, steps.length - 1)] as Step;
      const chunks: unknown[] = [];
      const pieces = step.text === undefined ? [] : [step.text].flat();
      if (pieces.length > 0) {
        chunks.push({ type: 'text-start', id: 't' });
        for (const delta of pieces) chunks.push({ type: 'text-delta', id: 't', delta });
        chunks.push({ type: 'text-end', id: 't' });
      }
      if (step.tool) {
        chunks.push({
          type: 'tool-call',
          toolCallId: `c${call}`,
          toolName: step.tool.name,
          input: JSON.stringify(step.tool.input),
        });
      }
      chunks.push({
        type: 'finish',
        finishReason: { unified: step.tool ? 'tool-calls' : 'stop', raw: undefined },
        usage: USAGE,
      });
      return {
        stream: new ReadableStream({
          async start(controller) {
            for (const c of chunks) {
              controller.enqueue(c);
              await new Promise((r) => setTimeout(r, 1));
            }
            controller.close();
          },
        }),
      } as never;
    },
  });
}

export const settings: TurnSettings = {
  prompts: memoryPrompts({ core: 'Core.', 'skill/deep': 'Go deep.' }),
  contextTokenBudget: 4000,
  maxOutputTokens: 256,
  maxMessageChars: 200,
  turnTimeoutMs: 5000,
  summaryModel: 'openai:summary',
  recordContent: false,
};

export async function readAll<T>(stream: ReadableStream<T>): Promise<T[]> {
  const out: T[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) return out;
    out.push(value);
  }
}
