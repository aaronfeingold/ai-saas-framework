import { MockLanguageModelV4 } from 'ai/test';
import pino from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  type AgentBudget,
  type AgentDefinition,
  type AgentStore,
  type BaseCtx,
  defineOperation,
  runAgent,
  type TurnSettings,
  type UsageRecord,
} from '../src/index.js';
import { memoryPrompts } from './helpers/prompts.js';

type Ctx = BaseCtx;
const logger = pino({ level: 'silent' });
const ctx: Ctx = { userId: 'ann', logger };

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
type Step = { text?: string; tool?: { name: string; input: unknown }; delayMs?: number } | Error;
const toolCall = (name: string, input: unknown = {}): Step => ({ tool: { name, input } });
const text = (t: string): Step => ({ text: t });

/** Answers each call with the next step; the last step repeats. */
function scripted(steps: Step[], onCall?: (n: number) => void) {
  let call = 0;
  return new MockLanguageModelV4({
    doGenerate: async ({ abortSignal }) => {
      const step = steps[Math.min(call++, steps.length - 1)] as Step;
      onCall?.(call);
      if (step instanceof Error) throw step;
      if (step.delayMs) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, step.delayMs);
          abortSignal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }
      const content: unknown[] = [];
      if (step.text) content.push({ type: 'text', text: step.text });
      if (step.tool) {
        content.push({
          type: 'tool-call',
          toolCallId: `c${call}`,
          toolName: step.tool.name,
          input: JSON.stringify(step.tool.input),
        });
      }
      return {
        content,
        finishReason: { unified: step.tool ? 'tool-calls' : 'stop', raw: undefined },
        usage: USAGE,
        warnings: [],
      } as never;
    },
  });
}

let recorded: UsageRecord[];
let looked: string[];
let costPerStep: bigint;

const lookup = defineOperation<Ctx, z.ZodObject<{ q: z.ZodString }>, { found: string }>({
  id: 'lookup',
  description: 'Look something up.',
  method: 'get',
  path: '/api/lookup',
  input: z.object({ q: z.string() }),
  output: z.object({ found: z.string() }),
  agentTool: true,
  handler: async (c, input) => {
    looked.push(`${input.q}@${c.agentDepth}`);
    if (input.q === 'boom') throw new Error('lookup broke');
    return { found: input.q };
  },
});

const store = {
  recordUsage: async (_ctx: Ctx, record: UsageRecord) => {
    recorded.push(record);
    return { costMicroUsd: costPerStep };
  },
} as unknown as AgentStore<Ctx>;

const agent: AgentDefinition<Ctx> = {
  id: 'example',
  operations: [lookup],
  store,
  corePromptName: 'example/core',
};
const settings: TurnSettings = {
  prompts: memoryPrompts({ 'example/core': 'You look things up.' }),
  contextTokenBudget: 4000,
  maxOutputTokens: 256,
  maxMessageChars: 200,
  turnTimeoutMs: 5000,
  summaryModel: 'openai:summary',
  recordContent: false,
};
const budget: AgentBudget = { maxSteps: 6, timeoutMs: 5000, maxCostMicroUsd: 1_000_000n };

const deps = (model: MockLanguageModelV4) => ({ agent, settings, resolveModel: () => model });
const input = (over: Partial<Parameters<typeof runAgent<Ctx>>[2]> = {}) => ({
  task: 'Find x.',
  model: 'openai:test',
  budget,
  payer: 'user' as const,
  ...over,
});

beforeEach(() => {
  recorded = [];
  looked = [];
  costPerStep = 1n;
});

describe('runAgent', () => {
  it('runs tools to completion and returns the final text', async () => {
    const model = scripted([toolCall('lookup', { q: 'x' }), text('found it')]);
    const r = await runAgent(deps(model), ctx, input());
    expect(r).toMatchObject({
      status: 'complete',
      text: 'found it',
      steps: 2,
      costMicroUsd: 2n,
      toolCalls: [{ tool: 'lookup', failed: false }],
    });
    expect(r.stoppedBy).toBeUndefined();
  });

  it('gives the model its instructions, the task, and what its tools returned', async () => {
    const model = scripted([toolCall('lookup', { q: 'x' }), text('done')]);
    await runAgent(deps(model), ctx, input());
    const second = JSON.stringify(model.doGenerateCalls[1]?.prompt);
    expect(second).toContain('You look things up.');
    expect(second).toContain('Find x.');
    expect(second).toContain('"found":"x"');
  });

  it('reports a tool that failed without stopping the run', async () => {
    const model = scripted([toolCall('lookup', { q: 'boom' }), text('carried on')]);
    const r = await runAgent(deps(model), ctx, input());
    expect(r).toMatchObject({ status: 'complete', toolCalls: [{ tool: 'lookup', failed: true }] });
  });

  it('stops at the step budget and says so', async () => {
    const model = scripted([toolCall('lookup', { q: 'x' })]);
    const r = await runAgent(deps(model), ctx, input({ budget: { ...budget, maxSteps: 3 } }));
    expect(r).toMatchObject({ status: 'partial', stoppedBy: 'steps', steps: 3 });
    expect(model.doGenerateCalls).toHaveLength(3);
  });

  it('stops once recorded spend reaches the ceiling', async () => {
    costPerStep = 600n;
    const model = scripted([toolCall('lookup', { q: 'x' })]);
    const r = await runAgent(
      deps(model),
      ctx,
      input({ budget: { ...budget, maxCostMicroUsd: 1000n } }),
    );
    expect(r).toMatchObject({
      status: 'partial',
      stoppedBy: 'spend',
      steps: 2,
      costMicroUsd: 1200n,
    });
  });

  it('stops at the time budget', async () => {
    const model = scripted([{ text: 'slow', delayMs: 300 }]);
    const r = await runAgent(deps(model), ctx, input({ budget: { ...budget, timeoutMs: 50 } }));
    expect(r).toMatchObject({ status: 'partial', stoppedBy: 'time' });
  });

  it('stops when the caller aborts, and still records what was used', async () => {
    const controller = new AbortController();
    const model = scripted(
      [toolCall('lookup', { q: 'x' }), { text: 'never', delayMs: 2000 }],
      (n) => {
        if (n === 2) setTimeout(() => controller.abort(), 10);
      },
    );
    const r = await runAgent(deps(model), ctx, input({ abortSignal: controller.signal }));
    expect(r).toMatchObject({ status: 'partial', stoppedBy: 'abort', steps: 1 });
    expect(recorded).toHaveLength(1);
  });

  it('does not start a step when the caller has already aborted', async () => {
    const model = scripted([text('x')]);
    const r = await runAgent(deps(model), ctx, input({ abortSignal: AbortSignal.abort() }));
    expect(r).toMatchObject({ status: 'partial', stoppedBy: 'abort', steps: 0 });
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it('records usage with the agent name and payer', async () => {
    await runAgent(deps(scripted([text('ok')])), ctx, input({ payer: 'library' }));
    expect(recorded[0]).toMatchObject({
      agent: 'example',
      payer: 'library',
      purpose: 'agent',
      model: 'openai:test',
      sessionId: null,
    });
  });

  it('tells its tools they are running inside a sub-agent', async () => {
    await runAgent(deps(scripted([toolCall('lookup', { q: 'x' }), text('ok')])), ctx, input());
    expect(looked).toEqual(['x@1']);
  });

  it('refuses to start from inside another sub-agent', async () => {
    const model = scripted([text('ok')]);
    await expect(runAgent(deps(model), { ...ctx, agentDepth: 1 }, input())).rejects.toMatchObject({
      code: 'agent_depth_exceeded',
    });
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it('reports a model failure as a failed run, not an exception', async () => {
    const r = await runAgent(deps(scripted([new Error('provider down')])), ctx, input());
    expect(r).toMatchObject({ status: 'failed', steps: 0, text: '' });
  });

  it('keeps what it found when the model fails part-way', async () => {
    const model = scripted([
      { text: 'so far', tool: { name: 'lookup', input: { q: 'x' } } },
      new Error('down'),
    ]);
    const r = await runAgent(deps(model), ctx, input());
    expect(r).toMatchObject({ status: 'failed', steps: 1, text: 'so far' });
  });
});
