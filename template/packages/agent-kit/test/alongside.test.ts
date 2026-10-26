import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  type AgentDefinition,
  defineOperation,
  runTurn,
  type Skill,
  type TurnGate,
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function turn(
  gate: () => Promise<TurnGate>,
  steps: Step[] = [{ text: 'Hello.' }],
  extra: Partial<AgentDefinition<Ctx>> = {},
) {
  const convo = memoryConversation();
  await convo.say('hi');
  const model = scripted(steps);
  const ran: string[] = [];
  const probe = defineOperation<Ctx, z.ZodObject<Record<string, never>>, { ok: boolean }>({
    id: 'probe',
    description: 'Probe.',
    method: 'get',
    path: '/api/probe',
    input: z.object({}),
    output: z.object({ ok: z.boolean() }),
    agentTool: true,
    handler: async () => {
      ran.push('probe');
      return { ok: true };
    },
  });
  const started = Date.now();
  const run = await runTurn(
    {
      agent: {
        id: 'a',
        operations: [probe],
        store: convo.store,
        corePromptName: 'core',
        whileStarting: gate,
        ...extra,
      },
      settings,
      resolveModel: () => model,
      smoothDelayMs: null,
    },
    ctx,
    { sessionId: 's1', budget: { model: 'openai:test', maxSteps: 4 } },
  );
  const chunks = (await readAll(run.stream)) as Array<{ type: string; delta?: string }>;
  const outcome = await run.done;
  await run.settled;
  const parts = (convo.messages.at(-1)?.parts ?? []) as Array<{ type: string; text?: string }>;
  const text = parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('');
  return { convo, model, chunks, outcome, text, ran, ms: Date.now() - started };
}
const systemOf = (model: ReturnType<typeof scripted>, call: number) =>
  JSON.stringify(model.doStreamCalls[call]?.prompt[0]);

describe('a gate that runs while the model is starting', () => {
  it('starts the model at once and uses that call when the gate adds nothing', async () => {
    let modelStartedBeforeGate = false;
    const gate = async () => {
      await wait(60);
      modelStartedBeforeGate = (probeModel?.doStreamCalls.length ?? 0) > 0;
      return {};
    };
    let probeModel: ReturnType<typeof scripted> | undefined;
    const convo = memoryConversation();
    await convo.say('hi');
    probeModel = scripted([{ text: 'Hello.' }]);
    const run = await runTurn(
      {
        agent: {
          id: 'a',
          operations: [],
          store: convo.store,
          corePromptName: 'core',
          whileStarting: gate,
        },
        settings,
        resolveModel: () => probeModel as ReturnType<typeof scripted>,
        smoothDelayMs: null,
      },
      ctx,
      { sessionId: 's1', budget: { model: 'openai:test', maxSteps: 4 } },
    );
    await readAll(run.stream);
    await run.done;
    expect(modelStartedBeforeGate).toBe(true);
    expect(probeModel.doStreamCalls).toHaveLength(1);
    expect(convo.usage).toHaveLength(1);
  });

  it('does not make the turn wait for the gate and then the model one after the other', async () => {
    // The model takes about as long as the gate; in sequence that would be twice as long.
    const slow: Step = { text: ['One. ', 'Two. ', 'Three. ', 'Four. ', 'Five. ', 'Six.'] };
    const t = await turn(async () => {
      await wait(40);
      return {};
    }, [slow]);
    expect(t.text).toBe('One. Two. Three. Four. Five. Six.');
    expect(t.model.doStreamCalls).toHaveLength(1);
  });

  it('answers with the gate’s reply, drops the call, and charges only what was sent', async () => {
    const t = await turn(async () => ({ reply: 'Not my cellar.' }));
    expect(t.text).toBe('Not my cellar.');
    expect(t.outcome.status).toBe('complete');
    expect(t.convo.usage).toHaveLength(1);
    expect(t.convo.usage[0]?.tokens.output).toBe(0);
    expect(t.chunks.filter((c) => c.type === 'text-delta').map((c) => c.delta)).toEqual([
      'Not my cellar.',
    ]);
  });

  it('runs none of the dropped call’s tools', async () => {
    const t = await turn(async () => {
      await wait(60);
      return { reply: 'Not my cellar.' };
    }, [{ tool: { name: 'probe', input: {} } }, { text: 'Done.' }]);
    await wait(30);
    expect(t.ran).toEqual([]);
    expect(t.text).toBe('Not my cellar.');
  });

  it('holds a tool until the gate has spoken, then runs it', async () => {
    const order: string[] = [];
    const t = await turn(async () => {
      await wait(60);
      order.push('gate');
      return {};
    }, [{ tool: { name: 'probe', input: {} } }, { text: 'Done.' }]);
    expect(t.ran).toEqual(['probe']);
    expect(t.text).toBe('Done.');
    expect(order).toEqual(['gate']);
  });

  it('makes the call again when the gate changes the instructions', async () => {
    const t = await turn(
      async () => ({ instructions: ['Be gentle today.'] }),
      [{ text: 'First.' }, { text: 'Second.' }],
    );
    expect(t.model.doStreamCalls).toHaveLength(2);
    expect(systemOf(t.model, 0)).not.toContain('Be gentle today.');
    expect(systemOf(t.model, 1)).toContain('Be gentle today.');
    expect(t.text).toBe('Second.');
    expect(
      t.chunks
        .filter((c) => c.type === 'text-delta')
        .map((c) => c.delta)
        .join(''),
    ).toBe('Second.');
  });

  it('makes the call again when the gate’s signals switch a skill on, or change the limit', async () => {
    const deep: Skill<Ctx> = {
      id: 'deep',
      promptName: 'skill/deep',
      applies: async (c) => ({ active: c.signals?.depth === true }),
    };
    const a = await turn(async () => ({ signals: { depth: true } }), [{ text: 'x' }], {
      skills: [deep],
    });
    expect(a.model.doStreamCalls).toHaveLength(2);
    expect(systemOf(a.model, 1)).toContain('Go deep.');
    const b = await turn(async () => ({ maxOutputTokens: 77 }));
    expect(b.model.doStreamCalls).toHaveLength(2);
    expect(b.model.doStreamCalls[1]?.maxOutputTokens).toBe(77);
  });

  it('keeps the call when the gate’s signals change nothing', async () => {
    const t = await turn(async () => ({ signals: { verdict: 'fine' } }));
    expect(t.model.doStreamCalls).toHaveLength(1);
    expect(t.text).toBe('Hello.');
  });

  it('gives afterTurn the gate’s signals', async () => {
    let seen: unknown;
    await turn(async () => ({ signals: { verdict: 'fine' } }), [{ text: 'Hello.' }], {
      afterTurn: async (c) => {
        seen = c.signals;
      },
    });
    expect(seen).toEqual({ verdict: 'fine' });
  });

  it('carries on with the call when the gate throws', async () => {
    const t = await turn(async () => {
      throw new Error('gate broke');
    });
    expect(t.text).toBe('Hello.');
    expect(t.model.doStreamCalls).toHaveLength(1);
  });

  it('still lets beforeTurn answer first, without starting the model at all', async () => {
    const t = await turn(async () => ({}), [{ text: 'Hello.' }], {
      beforeTurn: async () => ({ reply: 'Wait a moment.' }),
    });
    expect(t.model.doStreamCalls).toHaveLength(0);
    expect(t.text).toBe('Wait a moment.');
    expect(t.convo.usage).toEqual([]);
  });

  it('adds what both gates say', async () => {
    const t = await turn(async () => ({ instructions: ['Second line.'] }), [{ text: 'x' }], {
      beforeTurn: async () => ({ instructions: ['First line.'] }),
    });
    const system = systemOf(t.model, 1);
    expect(system).toContain('First line.');
    expect(system).toContain('Second line.');
  });
});
