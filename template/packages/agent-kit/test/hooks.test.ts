import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  type AgentDefinition,
  defineOperation,
  runTurn,
  type Skill,
  type TurnReport,
} from '../src/index.js';
import {
  type Ctx,
  ctx,
  memoryConversation,
  readAll,
  type Step,
  scripted,
  settings,
} from './helpers/turn.js';

const probe = defineOperation<Ctx, z.ZodObject<Record<string, never>>, { ok: boolean }>({
  id: 'probe',
  description: 'Probe.',
  method: 'get',
  path: '/api/probe',
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  agentTool: true,
  handler: async () => ({ ok: true }),
});

async function turn(hooks: Partial<AgentDefinition<Ctx>>, steps: Step[] = [{ text: 'Hello.' }]) {
  const convo = memoryConversation();
  await convo.say('hi');
  const model = scripted(steps);
  const run = await runTurn(
    {
      agent: { id: 'a', operations: [probe], store: convo.store, corePromptName: 'core', ...hooks },
      settings,
      resolveModel: () => model,
      smoothDelayMs: null,
    },
    ctx,
    { sessionId: 's1', budget: { model: 'openai:test', maxSteps: 4 } },
  );
  const chunks = await readAll(run.stream);
  const outcome = await run.done;
  await run.settled;
  const reply = convo.messages.at(-1);
  const text = ((reply?.parts ?? []) as Array<{ type: string; text?: string }>)
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('');
  return { convo, model, chunks, outcome, reply, text };
}
const deltas = (chunks: unknown[]) =>
  (chunks as Array<{ type: string; delta?: string }>)
    .filter((c) => c.type === 'text-delta')
    .map((c) => c.delta)
    .join('');
const systemOf = (model: ReturnType<typeof scripted>) =>
  JSON.stringify(model.doStreamCalls[0]?.prompt[0]);

describe('beforeTurn', () => {
  it('answers without calling the model, and stores the reply', async () => {
    const t = await turn({ beforeTurn: async () => ({ reply: 'Not my cellar.' }) });
    expect(t.model.doStreamCalls).toHaveLength(0);
    expect(t.text).toBe('Not my cellar.');
    expect(t.outcome.status).toBe('complete');
    expect(t.reply).toMatchObject({ role: 'assistant', status: 'complete' });
    expect(t.convo.usage).toEqual([]);
  });

  it('streams a gated reply as text the client can render', async () => {
    const t = await turn({ beforeTurn: async () => ({ reply: 'Not my cellar.' }) });
    expect(deltas(t.chunks)).toBe('Not my cellar.');
    expect((t.chunks as Array<{ type: string }>).map((c) => c.type)).toEqual([
      'start',
      'start-step',
      'text-start',
      'text-delta',
      'text-end',
      'finish-step',
      'finish',
    ]);
  });

  it('is given the conversation, ending with the person’s message', async () => {
    let seen: string[] = [];
    await turn({
      beforeTurn: async (_c, t) => {
        seen = t.recent.map((m) => m.role);
        return {};
      },
    });
    expect(seen).toEqual(['user']);
  });

  it('adds instruction lines and signals for skills to read', async () => {
    const deep: Skill<Ctx> = {
      id: 'deep',
      promptName: 'skill/deep',
      applies: async (c) => ({ active: c.signals?.depth === true }),
    };
    const t = await turn({
      skills: [deep],
      beforeTurn: async () => ({ instructions: ['Be gentle today.'], signals: { depth: true } }),
    });
    expect(systemOf(t.model)).toContain('Be gentle today.');
    expect(systemOf(t.model)).toContain('Go deep.');
  });

  it('uses the per-turn output limit', async () => {
    const t = await turn({ beforeTurn: async () => ({ maxOutputTokens: 77 }) });
    expect(t.model.doStreamCalls[0]?.maxOutputTokens).toBe(77);
  });

  it('carries on when it throws', async () => {
    const t = await turn({
      beforeTurn: async () => {
        throw new Error('gate broke');
      },
    });
    expect(t.outcome.status).toBe('complete');
    expect(t.model.doStreamCalls).toHaveLength(1);
    expect(t.text).toBe('Hello.');
  });
});

describe('replyGuard', () => {
  const noCode = (text: string) => {
    const at = text.indexOf('```');
    return at < 0 ? null : { cutAt: at, append: 'Not my cellar.' };
  };

  it('cuts the reply where the guard says and appends its text', async () => {
    const t = await turn({ replyGuard: noCode }, [
      { text: ['Sure.\n', '```python\n', 'print(1)\n', 'print(2)\n'] },
    ]);
    expect(t.text).toBe('Sure.\n\nNot my cellar.');
    expect(t.outcome.status).toBe('complete');
    expect(deltas(t.chunks)).not.toContain('print(1)');
    expect(deltas(t.chunks).endsWith('Not my cellar.')).toBe(true);
    expect((t.chunks as Array<{ type: string }>).at(-1)?.type).toBe('finish');
  });

  it('stores only the appended text when the cut is at the start', async () => {
    const t = await turn({ replyGuard: noCode }, [{ text: ['```js\n', 'x\n'] }]);
    expect(t.text).toBe('Not my cellar.');
  });

  it('charges for a reply that was cut', async () => {
    const t = await turn({ replyGuard: noCode }, [{ text: ['Sure.\n', '```python\n', 'x\n'] }]);
    expect(t.convo.usage).toHaveLength(1);
  });

  it('leaves an ordinary reply alone', async () => {
    const t = await turn({ replyGuard: noCode }, [{ text: ['The 2019, ', 'at $48.'] }]);
    expect(t.text).toBe('The 2019, at $48.');
  });
});

describe('afterTurn', () => {
  it('reports an ordinary turn, with what its tools returned', async () => {
    let report: TurnReport | undefined;
    await turn(
      {
        afterTurn: async (_c, r) => {
          report = r;
        },
      },
      [{ tool: { name: 'probe', input: {} } }, { text: 'Done.' }],
    );
    expect(report).toMatchObject({
      sessionId: 's1',
      status: 'complete',
      replyText: 'Done.',
      toolOutputs: [{ ok: true }],
      gated: false,
      cut: false,
    });
  });

  it('reports a gated turn and a cut one', async () => {
    const reports: TurnReport[] = [];
    const afterTurn = async (_c: Ctx, r: TurnReport) => void reports.push(r);
    await turn({ afterTurn, beforeTurn: async () => ({ reply: 'No.' }) });
    await turn({ afterTurn, replyGuard: () => ({ cutAt: 0, append: 'No.' }) });
    expect(reports.map((r) => [r.gated, r.cut, r.replyText])).toEqual([
      [true, false, 'No.'],
      [false, true, 'No.'],
    ]);
  });

  it('does not fail the turn when it throws', async () => {
    const t = await turn({
      afterTurn: async () => {
        throw new Error('after broke');
      },
    });
    expect(t.outcome.status).toBe('complete');
  });
});
