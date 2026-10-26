import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_URL, createTestDatabase, scriptedModel, testApp, tokenFor } from './harness.js';

const ALICE = 'user-alice';
const BOB = 'user-bob';

describe.skipIf(!ADMIN_URL)('chat', () => {
  let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
  let api: ReturnType<typeof testApp>;

  const call = (path: string, user: string | null, body?: unknown) =>
    api.app.request(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'content-type': 'application/json',
        ...(user ? { authorization: `Bearer ${tokenFor(user)}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const newSession = async (user: string) =>
    ((await (await call('/api/sessions', user, {})).json()) as { id: string }).id;

  const start = async (
    model = scriptedModel([{ text: 'Hi' }]),
    env: Record<string, string> = {},
  ) => {
    ctx = await createTestDatabase();
    api = testApp(ctx.url, { model, env });
  };
  beforeEach(() => {
    ctx = undefined as never;
  });
  afterEach(async () => {
    await api?.db.end();
    await ctx?.drop();
  });

  it('needs a signed-in user', async () => {
    await start();
    expect((await call('/api/sessions', null, {})).status).toBe(401);
    const forged = await api.app.request('/api/sessions', {
      method: 'POST',
      headers: { authorization: 'Bearer not-a-token' },
    });
    expect(forged.status).toBe(401);
  });

  it("keeps one user out of another's conversation", async () => {
    await start();
    const id = await newSession(ALICE);
    expect((await call(`/api/sessions/${id}/messages`, ALICE)).status).toBe(200);
    expect((await call(`/api/sessions/${id}/messages`, BOB)).status).toBe(404);
    const res = await call('/api/chat', BOB, { sessionId: id, messageId: 'm1', text: 'hello' });
    expect(res.status).toBe(404);
  });

  it('runs a turn through a tool, stores it, and prices what it spent', async () => {
    const model = scriptedModel([
      { tool: { name: 'get_usage', input: {} } },
      { text: 'You have spent nothing today.' },
    ]);
    await start(model, { MODEL: 'openai:gpt-5-nano' });
    const id = await newSession(ALICE);

    const res = await call('/api/chat', ALICE, {
      sessionId: id,
      messageId: 'm1',
      text: 'How much have I used today?',
    });
    expect(res.status).toBe(200);
    const events = (await res.text())
      .split('\n')
      .filter((line) => line.startsWith('data: {'))
      .map(
        (line) => JSON.parse(line.slice(6)) as { type: string; delta?: string; output?: unknown },
      );
    // The tool ran against the database before the model answered.
    expect(events.find((e) => e.type === 'tool-output-available')?.output).toEqual({
      spentUsd: 0,
      dailyCapUsd: 0.5,
    });
    const text = events.flatMap((e) => (e.type === 'text-delta' ? [e.delta] : [])).join('');
    expect(text).toBe('You have spent nothing today.');

    // The tools the assistant was offered, and the prompt it was given.
    const first = model.doStreamCalls[0];
    expect((first?.tools ?? []).map((t) => t.name)).toEqual(['get_usage']);
    expect(JSON.stringify(first?.prompt)).toContain('You are the assistant inside this app');

    const messages = (await (await call(`/api/sessions/${id}/messages`, ALICE)).json()) as {
      messages: { role: string; status: string }[];
    };
    expect(messages.messages.map((m) => [m.role, m.status])).toEqual([
      ['user', 'complete'],
      ['assistant', 'complete'],
    ]);

    // Two steps of 2000 input and 100 output tokens on gpt-5-nano:
    // 2000 * $0.05/M + 100 * $0.40/M = 140 micro-dollars each.
    const usage = await api.db.query<{ user_id: string; cost: string; n: string }>(
      'SELECT user_id, sum(cost_micro_usd) AS cost, count(*) AS n FROM app.model_usage GROUP BY 1',
    );
    expect(usage.rows).toEqual([{ user_id: ALICE, cost: '280', n: '2' }]);
  });

  it('stops chat for everyone once the global daily cap is spent', async () => {
    await start(scriptedModel([{ text: 'Hi' }]), { GLOBAL_DAILY_SPEND_CAP_USD: '0.001' });
    await api.db.query(
      `INSERT INTO app.model_usage (user_id, model, purpose, agent, input_tokens,
         cached_input_tokens, output_tokens, cost_micro_usd)
       VALUES ($1, 'anthropic:claude-haiku-5-5', 'chat', 'assistant', 0, 0, 0, 1000)`,
      [BOB],
    );
    const id = await newSession(ALICE);
    const res = await call('/api/chat', ALICE, { sessionId: id, messageId: 'm1', text: 'hi' });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      error: { code: 'budget_exceeded', blockedBy: 'global' },
    });
  });
});
