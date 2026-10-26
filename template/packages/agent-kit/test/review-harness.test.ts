import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { type AgentDefinition, defineOperation, type ReplyVerdict, runTurn } from '../src/index.js';
import {
  type Ctx,
  ctx,
  memoryConversation,
  readAll,
  type Step,
  scripted,
  settings,
} from './helpers/turn.js';

// Defects found in the review of the harness branch.

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

/**
 * Cuts where a fence begins a line (taking any held lines just before it too), holds back a
 * line marked HOLD, and holds an unfinished line that might yet become a fence.
 */
const guard = (text: string, final: boolean): ReplyVerdict => {
  const lines = text.split('\n');
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }
  const firstHold = lines.findIndex((l) => l.startsWith('HOLD'));
  const fence = lines.findIndex((l) => l.startsWith('```'));
  if (fence >= 0) {
    const from = firstHold >= 0 && firstHold < fence ? firstHold : fence;
    return { cutAt: starts[from] as number, append: 'No code here.' };
  }
  if (firstHold >= 0) return { holdFrom: starts[firstHold] as number };
  const last = lines.at(-1) ?? '';
  if (!final && last.length > 0 && '```'.startsWith(last)) {
    return { holdFrom: starts.at(-1) as number };
  }
  return null;
};

async function turn(steps: Step[], hooks: Partial<AgentDefinition<Ctx>> = { replyGuard: guard }) {
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
  const chunks = (await readAll(run.stream)) as Array<{ type: string; delta?: string }>;
  const outcome = await run.done;
  await run.settled;
  const parts = (convo.messages.at(-1)?.parts ?? []) as Array<{ type: string; text?: string }>;
  const stored = parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('');
  const streamed = chunks
    .filter((c) => c.type === 'text-delta')
    .map((c) => c.delta)
    .join('');
  return { outcome, stored, streamed, chunks, parts };
}

describe('the reply guard across text parts', () => {
  it('sees a fence that opens a later part as the start of a line', async () => {
    const t = await turn([
      { text: 'Let me look.', tool: { name: 'probe', input: {} } },
      { text: ['```python\n', 'import os\n', 'os.rename("a", "b")\n', '```\n', 'Enjoy.'] },
    ]);
    expect(t.stored).not.toContain('import os');
    expect(t.stored).not.toContain('```');
    expect(t.streamed).not.toContain('import os');
    expect(t.streamed).not.toContain('```');
    expect(t.stored.endsWith('No code here.')).toBe(true);
  });
});

describe('what the person sees when a reply is cut', () => {
  it('never shows the code, even in pieces, and never an opening fence', async () => {
    const t = await turn([{ text: ['Sure.\n', '`', '``', 'python\n', 'print(1)\n'] }]);
    expect(t.streamed).not.toContain('`');
    expect(t.streamed).not.toContain('print');
  });

  it('shows the same text that is stored', async () => {
    const t = await turn([{ text: ['Sure.\n', '```python\n', 'print(1)\n'] }]);
    expect(t.streamed).toBe(t.stored);
    expect(t.stored).toBe('Sure.\n\nNo code here.');
  });

  it('holds back text the guard is unsure of, and releases it when the reply ends clean', async () => {
    const t = await turn([{ text: ['Fine.\n', 'HOLD this line\n', 'and this.'] }]);
    expect(t.stored).toBe('Fine.\nHOLD this line\nand this.');
    expect(t.streamed).toBe(t.stored);
    const deltas = t.chunks.filter((c) => c.type === 'text-delta').map((c) => c.delta);
    // Nothing from the held line onwards went out until the end.
    expect(deltas[0]).toBe('Fine.\n');
    expect(deltas.slice(0, -1).join('')).not.toContain('HOLD');
  });

  it('does not show held text when the reply is then cut', async () => {
    const t = await turn([{ text: ['Fine.\n', 'HOLD maybe code\n', '```\n', 'x\n'] }]);
    expect(t.streamed).not.toContain('HOLD');
    expect(t.streamed).toBe('Fine.\n\nNo code here.');
  });

  it('streams ordinary text piece by piece, as before', async () => {
    const t = await turn([{ text: ['The 2019, ', 'at $48, ', 'is lovely.'] }]);
    expect(t.chunks.filter((c) => c.type === 'text-delta').map((c) => c.delta)).toEqual([
      'The 2019, ',
      'at $48, ',
      'is lovely.',
    ]);
  });

  it('keeps the tool and other parts of a turn whose text was cut', async () => {
    const t = await turn([
      { text: 'One moment.', tool: { name: 'probe', input: {} } },
      { text: ['Here:\n', '```js\n', 'x\n'] },
    ]);
    expect(t.parts.some((p) => p.type !== 'text')).toBe(true);
  });

  it('treats an empty replacement as a cut, not a failure', async () => {
    const t = await turn([{ text: ['```\n', 'x\n'] }], {
      replyGuard: (text) => (text.includes('```') ? { cutAt: 0, append: '' } : null),
    });
    expect(t.outcome.status).toBe('complete');
  });
});
