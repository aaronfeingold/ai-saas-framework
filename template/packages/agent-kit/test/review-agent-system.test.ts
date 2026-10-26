import { MockLanguageModelV4 } from 'ai/test';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  type AgentDefinition,
  type AgentStore,
  type BaseCtx,
  buildTools,
  defineOperation,
  runAgent,
  type TurnSettings,
} from '../src/index.js';
import { memoryPrompts } from './helpers/prompts.js';

// Defects found in the review of the agent-system branch.

type Ctx = BaseCtx;
const logger = pino({ level: 'silent' });
const ctx: Ctx = { userId: 'ann', logger };
const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

/** First call asks for the tool; every later call answers in text. */
const callsToolOnce = (tool: string) => {
  let call = 0;
  return new MockLanguageModelV4({
    doGenerate: async () =>
      ({
        content:
          call++ === 0
            ? [{ type: 'tool-call', toolCallId: 'c1', toolName: tool, input: '{}' }]
            : [{ type: 'text', text: 'done' }],
        finishReason: { unified: call === 1 ? 'tool-calls' : 'stop', raw: undefined },
        usage: USAGE,
        warnings: [],
      }) as never,
  });
};

const settings: TurnSettings = {
  prompts: memoryPrompts({ core: 'Core.' }),
  contextTokenBudget: 4000,
  maxOutputTokens: 256,
  maxMessageChars: 200,
  turnTimeoutMs: 5000,
  summaryModel: 'openai:summary',
  recordContent: false,
};
const store = { recordUsage: async () => ({ costMicroUsd: 1n }) } as unknown as AgentStore<Ctx>;

function slowTool(ms: number, seen: { signal?: AbortSignal; aborted?: boolean }) {
  return defineOperation<Ctx, z.ZodObject<Record<string, never>>, { ok: boolean }>({
    id: 'slow',
    description: 'Slow.',
    method: 'get',
    path: '/api/slow',
    input: z.object({}),
    output: z.object({ ok: z.boolean() }),
    agentTool: true,
    handler: async (c) => {
      seen.signal = c.abortSignal;
      await new Promise((resolve) => setTimeout(resolve, ms));
      seen.aborted = c.abortSignal?.aborted;
      return { ok: true };
    },
  });
}
const agentWith = (op: ReturnType<typeof slowTool>): AgentDefinition<Ctx> => ({
  id: 'example',
  operations: [op],
  store,
  corePromptName: 'core',
});
const budget = { maxSteps: 4, timeoutMs: 5000, maxCostMicroUsd: 1_000_000n };

describe('a sub-agent whose tool is slow', () => {
  it('returns at the time budget instead of waiting for the tool', async () => {
    const seen: { signal?: AbortSignal; aborted?: boolean } = {};
    const started = Date.now();
    const r = await runAgent(
      {
        agent: agentWith(slowTool(1500, seen)),
        settings,
        resolveModel: () => callsToolOnce('slow'),
      },
      ctx,
      { task: 'x', model: 'openai:test', budget: { ...budget, timeoutMs: 100 }, payer: 'user' },
    );
    expect(r).toMatchObject({ status: 'partial', stoppedBy: 'time' });
    expect(Date.now() - started).toBeLessThan(700);
  });

  it('gives the tool a signal that fires when the run is cut short', async () => {
    const seen: { signal?: AbortSignal; aborted?: boolean } = {};
    await runAgent(
      {
        agent: agentWith(slowTool(300, seen)),
        settings,
        resolveModel: () => callsToolOnce('slow'),
      },
      ctx,
      { task: 'x', model: 'openai:test', budget: { ...budget, timeoutMs: 100 }, payer: 'user' },
    );
    expect(seen.signal).toBeInstanceOf(AbortSignal);
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(seen.aborted).toBe(true);
  });

  it('returns when the caller stops it, and the tool is told', async () => {
    const seen: { signal?: AbortSignal; aborted?: boolean } = {};
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 80);
    const started = Date.now();
    const r = await runAgent(
      {
        agent: agentWith(slowTool(1500, seen)),
        settings,
        resolveModel: () => callsToolOnce('slow'),
      },
      ctx,
      { task: 'x', model: 'openai:test', budget, payer: 'user', abortSignal: controller.signal },
    );
    expect(r).toMatchObject({ status: 'partial', stoppedBy: 'abort' });
    expect(Date.now() - started).toBeLessThan(700);
    expect(seen.signal?.aborted).toBe(true);
  });
});

describe('tool scope', () => {
  const op = (id: string, extra: { skill?: string | string[]; agents?: string[] } = {}) =>
    defineOperation<Ctx, z.ZodObject<Record<string, never>>, { ok: boolean }>({
      id,
      description: `${id}.`,
      method: 'get',
      path: `/api/${id}`,
      input: z.object({}),
      output: z.object({ ok: z.boolean() }),
      agentTool: true,
      ...extra,
      handler: async () => ({ ok: true }),
    });

  it('offers a tool that belongs to several skills while any one of them is in force', () => {
    const ops = [op('menu', { skill: ['table', 'kitchen'] }), op('list', { skill: 'table' })];
    const names = (active: string[]) =>
      Object.keys(buildTools(ops, ctx, { agentId: 'a', activeSkillIds: active }));
    expect(names([])).toEqual([]);
    expect(names(['kitchen'])).toEqual(['menu']);
    expect(names(['table'])).toEqual(['menu', 'list']);
  });

  it('cannot be called without saying who is asking', () => {
    // @ts-expect-error the scope is required: leaving it out used to mean "everything"
    expect(() => buildTools([op('a')], ctx)).toThrow();
  });
});
