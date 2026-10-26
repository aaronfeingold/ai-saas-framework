import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MockLanguageModelV4 } from 'ai/test';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  type AgentDefinition,
  type AgentStore,
  assembleInstructions,
  type BaseCtx,
  type BudgetDecision,
  buildOpenApiDocument,
  buildTools,
  chatRoutes,
  createLimiter,
  createModelResolver,
  createOpenApiApp,
  createStreamRegistry,
  defineOperation,
  mountOperations,
  notFound,
  resolveSkills,
  runTurn,
  type Skill,
  type StoredMessage,
  type TurnSettings,
  type UsageRecord,
} from '../src/index.js';
import { memoryPrompts } from './helpers/prompts.js';

/**
 * A second agent, built from nothing but the kit: a note-taker with two operations and an
 * in-memory store. If this needs a change to the kit to work, the kit is not general.
 */

type Ctx = BaseCtx;
const logger = pino({ level: 'silent' });

// ---------- the agent's domain: notes ----------

const notes = new Map<string, string[]>();
const operations = [
  defineOperation<Ctx, z.ZodObject<{ text: z.ZodString }>, { count: number }>({
    id: 'add_note',
    description: 'Save a note for the person.',
    method: 'post',
    path: '/api/notes',
    input: z.object({ text: z.string().min(1) }),
    output: z.object({ count: z.number() }),
    agentTool: true,
    handler: async (ctx, input) => {
      const mine = notes.get(ctx.userId) ?? [];
      mine.push(input.text);
      notes.set(ctx.userId, mine);
      return { count: mine.length };
    },
  }),
  defineOperation<Ctx, z.ZodObject<Record<string, never>>, { notes: string[] }>({
    id: 'list_notes',
    description: 'List the person’s notes.',
    method: 'get',
    path: '/api/notes',
    input: z.object({}),
    output: z.object({ notes: z.array(z.string()) }),
    agentTool: false,
    handler: async (ctx) => ({ notes: notes.get(ctx.userId) ?? [] }),
  }),
];

// ---------- an AgentStore held in memory ----------

function memoryStore() {
  const sessions = new Map<
    string,
    { owner: string; messages: StoredMessage[]; lockedAt?: number }
  >();
  const usage: Array<UsageRecord & { userId: string }> = [];
  let decision: BudgetDecision = { state: 'allow', model: 'openai:test', maxSteps: 4 };
  let seq = 0;

  const own = (ctx: Ctx, id: string) => {
    const s = sessions.get(id);
    if (!s || s.owner !== ctx.userId) throw notFound('Session');
    return s;
  };

  const store: AgentStore<Ctx> = {
    async getContextWindow(ctx, id) {
      return { summary: null, recent: own(ctx, id).messages, overflow: [] };
    },
    async appendMessage(ctx, id, m) {
      const stored: StoredMessage = {
        id: `m${++seq}`,
        role: m.role,
        parts: m.parts,
        status: m.status ?? 'complete',
        clientMessageId: m.clientMessageId ?? null,
        createdAt: new Date().toISOString(),
      };
      own(ctx, id).messages.push(stored);
      return stored;
    },
    async updateSummary() {},
    async findTurnByClientMessageId(ctx, id, clientMessageId) {
      const { messages } = own(ctx, id);
      const i = messages.findIndex((m) => m.clientMessageId === clientMessageId);
      const user = messages[i];
      if (!user) return null;
      const next = messages[i + 1];
      return { user, assistant: next?.role === 'assistant' ? next : undefined };
    },
    async acquireTurn(ctx, id, at) {
      const s = own(ctx, id);
      if (s.lockedAt !== undefined) return false;
      s.lockedAt = at.getTime();
      return true;
    },
    async releaseTurn(ctx, id, at) {
      const s = own(ctx, id);
      if (s.lockedAt === at.getTime()) s.lockedAt = undefined;
    },
    checkBudget: async () => decision,
    async recordUsage(ctx, record) {
      usage.push({ ...record, userId: ctx.userId });
      return { costMicroUsd: 1n };
    },
  };

  return {
    store,
    usage,
    setDecision: (d: BudgetDecision) => {
      decision = d;
    },
    newSession: (owner: string) => {
      const id = `s${sessions.size + 1}`;
      sessions.set(id, { owner, messages: [] });
      return id;
    },
    messages: (id: string) => sessions.get(id)?.messages ?? [],
  };
}

// ---------- a scripted model ----------

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
type Step = {
  text?: string;
  tool?: { name: string; input: unknown };
  hang?: boolean;
  delayMs?: number;
};

function scripted(steps: Step[]) {
  let call = 0;
  return new MockLanguageModelV4({
    doStream: async ({ abortSignal }) => {
      const step = steps[Math.min(call++, steps.length - 1)] as Step;
      const chunks: unknown[] = [];
      if (step.text) {
        chunks.push(
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: step.text },
        );
        if (!step.hang) chunks.push({ type: 'text-end', id: 't' });
      }
      if (step.tool) {
        chunks.push({
          type: 'tool-call',
          toolCallId: `c${call}`,
          toolName: step.tool.name,
          input: JSON.stringify(step.tool.input),
        });
      }
      if (!step.hang) {
        chunks.push({
          type: 'finish',
          finishReason: { unified: step.tool ? 'tool-calls' : 'stop', raw: undefined },
          usage: USAGE,
        });
      }
      const stream = new ReadableStream({
        async start(controller) {
          if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
          for (const c of chunks) controller.enqueue(c);
          if (step.hang) {
            abortSignal?.addEventListener('abort', () =>
              controller.error(new DOMException('Aborted', 'AbortError')),
            );
            return;
          }
          controller.close();
        },
      });
      return { stream } as never;
    },
  });
}

// ---------- the app ----------

const settings: TurnSettings = {
  prompts: memoryPrompts({ 'notes/core': 'You take notes for the person. Be brief.' }),
  contextTokenBudget: 4000,
  maxOutputTokens: 256,
  maxMessageChars: 200,
  turnTimeoutMs: 5000,
  summaryModel: 'openai:summary',
  recordContent: false,
};

function build(steps: Step[]) {
  const mem = memoryStore();
  const model = scripted(steps);
  const agent: AgentDefinition<Ctx> = {
    id: 'notes',
    operations,
    store: mem.store,
    corePromptName: 'notes/core',
  };
  const app = createOpenApiApp<Ctx>();
  app.use('/api/*', async (c, next) => {
    const userId = c.req.header('x-user');
    if (!userId) return c.json({ error: { code: 'unauthenticated', message: 'no' } }, 401);
    c.set('ctx', { userId, logger });
    await next();
  });
  mountOperations(app, operations);
  chatRoutes(app, {
    agent,
    settings,
    resolveModel: () => model,
    smoothDelayMs: null,
    streams: createStreamRegistry(),
    limiter: createLimiter({ rpm: 100, maxConcurrent: 5 }),
    keepAliveMs: 15_000,
  });
  const post = (path: string, body: unknown, user = 'ann') =>
    app.request(path, {
      method: 'POST',
      headers: { 'x-user': user, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { app, mem, model, post };
}

const settle = async (probe: () => boolean) => {
  for (let i = 0; i < 200 && !probe(); i++) await new Promise((r) => setTimeout(r, 10));
};

describe('an agent built only from the kit', () => {
  it('serves its operations over HTTP and documents them', async () => {
    const { app, post } = build([{ text: 'ok' }]);
    expect(await (await post('/api/notes', { text: 'buy milk' }, 'http-user')).json()).toEqual({
      count: 1,
    });
    const listed = await app.request('/api/notes', { headers: { 'x-user': 'http-user' } });
    expect(await listed.json()).toEqual({ notes: ['buy milk'] });

    const doc = buildOpenApiDocument(operations, { title: 'Example', version: '0.0.0' }) as {
      paths: Record<string, Record<string, { operationId: string }>>;
    };
    expect(doc.paths['/api/notes']?.post?.operationId).toBe('add_note');
    expect(doc.paths['/api/notes']?.get?.operationId).toBe('list_notes');
  });

  it('offers the model only the operations flagged as tools', () => {
    expect(
      Object.keys(
        buildTools(operations, { userId: 'x', logger }, { agentId: 'notes', activeSkillIds: [] }),
      ),
    ).toEqual(['add_note']);
  });

  it('runs a tool for the caller, replies, stores the turn and records usage', async () => {
    const { mem, model, post } = build([
      { tool: { name: 'add_note', input: { text: 'call the dentist' } } },
      { text: 'Noted.' },
    ]);
    const sessionId = mem.newSession('tool-user');
    const res = await post(
      '/api/chat',
      { sessionId, messageId: 'm1', text: 'remind me to call the dentist' },
      'tool-user',
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('"delta":"Noted."');

    expect(notes.get('tool-user')).toEqual(['call the dentist']);
    expect(mem.messages(sessionId).map((m) => [m.role, m.status])).toEqual([
      ['user', 'complete'],
      ['assistant', 'complete'],
    ]);
    expect(mem.usage).toHaveLength(2);
    expect(mem.usage[0]).toMatchObject({
      userId: 'tool-user',
      model: 'openai:test',
      purpose: 'chat',
    });
    expect(model.doStreamCalls).toHaveLength(2);
    expect(JSON.stringify(model.doStreamCalls[0]?.prompt)).toContain('You take notes');
  });

  it('tells tools and instructions which chat they are serving', async () => {
    const seen: Array<string | undefined> = [];
    const mem = memoryStore();
    const probe = defineOperation<Ctx, z.ZodObject<Record<string, never>>, { ok: boolean }>({
      id: 'probe',
      description: 'Probe.',
      method: 'get',
      path: '/api/probe',
      input: z.object({}),
      output: z.object({ ok: z.boolean() }),
      agentTool: true,
      handler: async (ctx) => {
        seen.push(ctx.sessionId);
        return { ok: true };
      },
    });
    const app = createOpenApiApp<Ctx>();
    app.use('/api/*', async (c, next) => {
      c.set('ctx', { userId: 'ann', logger });
      await next();
    });
    chatRoutes(app, {
      agent: {
        id: 'notes',
        operations: [probe],
        store: mem.store,
        corePromptName: 'notes/core',
        buildContext: async (ctx) => {
          seen.push(ctx.sessionId);
          return [];
        },
      },
      settings,
      resolveModel: () => scripted([{ tool: { name: 'probe', input: {} } }, { text: 'ok' }]),
      smoothDelayMs: null,
      streams: createStreamRegistry(),
      limiter: createLimiter({ rpm: 100, maxConcurrent: 5 }),
      keepAliveMs: 15_000,
    });
    const sessionId = mem.newSession('ann');
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, messageId: 'm1', text: 'hi' }),
    });
    await res.text();
    expect(seen).toEqual([sessionId, sessionId]);
  });

  it('replays a finished turn instead of running it again', async () => {
    const { mem, model, post } = build([{ text: 'Once.' }]);
    const sessionId = mem.newSession('ann');
    const body = { sessionId, messageId: 'same', text: 'hi' };
    await (await post('/api/chat', body)).text();
    const again = await post('/api/chat', body);
    expect(((await again.json()) as { replay: boolean }).replay).toBe(true);
    expect(model.doStreamCalls).toHaveLength(1);
  });

  it('refuses a turn the store says is over budget, without calling the model', async () => {
    const { mem, model, post } = build([{ text: 'x' }]);
    const sessionId = mem.newSession('ann');
    mem.setDecision({
      state: 'blocked',
      model: 'openai:test',
      maxSteps: 4,
      blockedBy: 'day',
      resetsAt: new Date(Date.now() + 3_600_000),
    });
    const res = await post('/api/chat', { sessionId, messageId: 'm1', text: 'hi' });
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('budget_exceeded');
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it('uses whichever model the store’s budget decision names', async () => {
    const asked: string[] = [];
    const mem = memoryStore();
    mem.setDecision({ state: 'economy', model: 'compatible:small-local', maxSteps: 2 });
    const app = createOpenApiApp<Ctx>();
    app.use('/api/*', async (c, next) => {
      c.set('ctx', { userId: 'ann', logger });
      await next();
    });
    chatRoutes(app, {
      agent: { id: 'notes', operations, store: mem.store, corePromptName: 'notes/core' },
      settings,
      resolveModel: (spec) => {
        asked.push(spec);
        return scripted([{ text: 'ok' }]);
      },
      smoothDelayMs: null,
      streams: createStreamRegistry(),
      limiter: createLimiter({ rpm: 100, maxConcurrent: 5 }),
      keepAliveMs: 15_000,
    });
    const sessionId = mem.newSession('ann');
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, messageId: 'm1', text: 'hi' }),
    });
    await res.text();
    expect(asked).toEqual(['compatible:small-local']);
  });

  it('rejects a message longer than the agent’s limit', async () => {
    const { mem, post } = build([{ text: 'x' }]);
    const res = await post('/api/chat', {
      sessionId: mem.newSession('ann'),
      messageId: 'm1',
      text: 'a'.repeat(201),
    });
    expect(res.status).toBe(413);
  });

  it('hides another person’s session', async () => {
    const { mem, post } = build([{ text: 'x' }]);
    const sessionId = mem.newSession('ann');
    expect(
      (await post('/api/chat', { sessionId, messageId: 'm1', text: 'hi' }, 'bob')).status,
    ).toBe(404);
  });

  it('tells a developer why the model call failed, but only when asked to', async () => {
    const failing = () => {
      const model = new MockLanguageModelV4({
        doStream: async () => {
          throw new Error('You have no credits remaining.');
        },
      });
      return model;
    };
    const run = async (exposeErrorDetail: boolean) => {
      const mem = memoryStore();
      const app = createOpenApiApp<Ctx>();
      app.use('/api/*', async (c, next) => {
        c.set('ctx', { userId: 'ann', logger });
        await next();
      });
      chatRoutes(app, {
        agent: { id: 'notes', operations, store: mem.store, corePromptName: 'notes/core' },
        settings: { ...settings, exposeErrorDetail },
        resolveModel: failing,
        smoothDelayMs: null,
        streams: createStreamRegistry(),
        limiter: createLimiter({ rpm: 100, maxConcurrent: 5 }),
        keepAliveMs: 15_000,
      });
      const res = await app.request('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: mem.newSession('ann'), messageId: 'm1', text: 'hi' }),
      });
      return res.text();
    };
    expect(await run(true)).toContain('You have no credits remaining.');
    const hidden = await run(false);
    expect(hidden).toContain('"type":"error"');
    expect(hidden).not.toContain('credits');
  });

  it('stops on request and stores the partial reply as stopped', async () => {
    const { mem, post } = build([{ text: 'Partial ', hang: true }]);
    const sessionId = mem.newSession('ann');
    const res = await post('/api/chat', { sessionId, messageId: 'm1', text: 'hi' });
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    let seen = '';
    while (!seen.includes('Partial')) {
      const { done, value } = await reader.read();
      if (done) break;
      seen += new TextDecoder().decode(value);
    }
    expect(await (await post(`/api/chat/${sessionId}/stop`, {})).json()).toEqual({ stopped: true });
    while (!(await reader.read()).done) {}
    expect(mem.messages(sessionId).at(-1)).toMatchObject({ role: 'assistant', status: 'stopped' });
    // The stopped reply is still charged, as an estimate.
    expect(mem.usage).toHaveLength(1);
  });

  it('finishes and stores the reply after the client disconnects, and frees the session', async () => {
    const { mem, post } = build([{ text: 'All of it.', delayMs: 60 }]);
    const sessionId = mem.newSession('ann');
    const res = await post('/api/chat', { sessionId, messageId: 'm1', text: 'hi' });
    await res.body?.cancel();
    await settle(() => mem.messages(sessionId).length === 2);
    expect(mem.messages(sessionId).at(-1)).toMatchObject({ role: 'assistant', status: 'complete' });
    expect((await post('/api/chat', { sessionId, messageId: 'm2', text: 'again' })).status).toBe(
      200,
    );
  });
});

describe('createModelResolver', () => {
  const resolve = createModelResolver({
    openaiApiKey: 'k',
    anthropicApiKey: 'k',
    compatible: { baseURL: 'http://localhost:11434/v1' },
  });

  it('resolves each provider form', () => {
    expect(resolve('openai:some-model')).toMatchObject({ modelId: 'some-model' });
    expect(resolve('anthropic:some-model')).toMatchObject({ modelId: 'some-model' });
    expect(resolve('compatible:org/open-weight-model')).toMatchObject({
      modelId: 'org/open-weight-model',
    });
  });

  it('keeps colons that belong to the model id', () => {
    expect(resolve('compatible:llama3.1:8b')).toMatchObject({ modelId: 'llama3.1:8b' });
  });

  it('rejects an unknown provider and a missing model id', () => {
    expect(() => resolve('mistral:x')).toThrow(/expected "openai:<id>"/);
    expect(() => resolve('openai:')).toThrow(/Unknown model/);
    expect(() => resolve('no-prefix')).toThrow(/Unknown model/);
  });

  it('explains what is missing when a compatible model is used without a base URL', () => {
    expect(() => createModelResolver({})('compatible:x')).toThrow(/base URL/);
  });
});

describe('the kit’s independence', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
    );

  it('imports nothing from an application, Prisma or Neo4j', () => {
    const src = new URL('../src', import.meta.url).pathname;
    for (const file of files(src)) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/from '[^']*(apps\/|@prisma|neo4j-driver|generated\/prisma)/);
      expect(text, file).not.toMatch(/process\.env/);
    }
  });
});

// ---------- skills ----------

describe('skills', () => {
  const op = (id: string, extra: { skill?: string; agents?: string[] } = {}) =>
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
  const ops = [
    op('core_tool'),
    op('table_tool', { skill: 'table' }),
    op('research_tool', { agents: ['research'] }),
  ];
  const skillPrompts = memoryPrompts({
    'notes/core': 'Core.',
    'skill/table': 'At the table: {{wines}} wines.',
    'skill/shop': 'In the shop.',
  });
  const table: Skill<Ctx> = {
    id: 'table',
    promptName: 'skill/table',
    applies: async () => ({ active: true, facts: { wines: 42 } }),
  };
  const shop: Skill<Ctx> = {
    id: 'shop',
    promptName: 'skill/shop',
    applies: async () => ({ active: true }),
  };
  const off: Skill<Ctx> = {
    id: 'off',
    promptName: 'skill/shop',
    applies: async () => ({ active: false }),
  };
  const ctx: Ctx = { userId: 'ann', logger };

  it('returns only active skills, in declared order, with facts filled in', async () => {
    const active = await resolveSkills([off, table, shop], ctx, skillPrompts);
    expect(active.map((s) => s.id)).toEqual(['table', 'shop']);
    expect(active[0]?.prompt.text).toBe('At the table: 42 wines.');
  });

  it('treats a skill whose check throws as inactive and logs it', async () => {
    const warned: unknown[] = [];
    const spying = { ...ctx, logger: { ...logger, warn: (o: unknown) => warned.push(o) } } as Ctx;
    const throwing: Skill<Ctx> = {
      id: 'throwing',
      promptName: 'skill/shop',
      applies: async () => {
        throw new Error('database hiccup');
      },
    };
    const active = await resolveSkills([throwing, shop], spying, skillPrompts);
    expect(active.map((s) => s.id)).toEqual(['shop']);
    expect(warned).toContainEqual(expect.objectContaining({ skill: 'throwing' }));
  });

  it('leaves out a skill whose prompt cannot be filled', async () => {
    const unfilled: Skill<Ctx> = { ...table, applies: async () => ({ active: true }) };
    expect(await resolveSkills([unfilled], ctx, skillPrompts)).toEqual([]);
  });

  it('puts the core first, then skills, then context, then the summary', () => {
    const text = assembleInstructions({
      core: 'Core.',
      skills: [
        { id: 'table', prompt: { name: 'n', text: 'Skill.', version: '1', source: 'file' } },
      ],
      context: ['About them.', ''],
      summary: 'Earlier.',
    });
    expect(text).toBe(
      'Core.\n\nSkill.\n\nAbout them.\n\n## Earlier in this conversation\nEarlier.',
    );
  });

  it('offers a tool only to its agents and only while its skill is active', () => {
    const names = (scope: { agentId: string; activeSkillIds: string[] }) =>
      Object.keys(buildTools(ops, ctx, scope));
    expect(names({ agentId: 'notes', activeSkillIds: [] })).toEqual(['core_tool']);
    expect(names({ agentId: 'notes', activeSkillIds: ['table'] })).toEqual([
      'core_tool',
      'table_tool',
    ]);
    expect(names({ agentId: 'research', activeSkillIds: [] })).toEqual([
      'core_tool',
      'research_tool',
    ]);
  });

  async function turn(skills: Skill<Ctx>[], steps: Step[]) {
    const mem = memoryStore();
    const model = scripted(steps);
    const sessionId = mem.newSession('ann');
    await mem.store.appendMessage(ctx, sessionId, {
      role: 'user',
      parts: [{ type: 'text', text: 'hi' }],
    });
    const run = await runTurn(
      {
        agent: {
          id: 'notes',
          operations: ops,
          store: mem.store,
          corePromptName: 'notes/core',
          skills,
        },
        settings: { ...settings, prompts: skillPrompts },
        resolveModel: () => model,
        smoothDelayMs: null,
      },
      ctx,
      { sessionId, budget: { model: 'openai:test', maxSteps: 4 } },
    );
    const outcome = await run.done;
    return { outcome, model, reply: mem.messages(sessionId).at(-1) };
  }
  const offeredTo = (model: ReturnType<typeof scripted>) =>
    (model.doStreamCalls[0]?.tools ?? []).map((t) => t.name).sort();
  const systemOf = (model: ReturnType<typeof scripted>) =>
    JSON.stringify(model.doStreamCalls[0]?.prompt[0]);

  it('sends the active skill’s instructions and tools to the model', async () => {
    const { model } = await turn([table], [{ text: 'ok' }]);
    expect(systemOf(model)).toContain('At the table: 42 wines.');
    expect(offeredTo(model)).toEqual(['core_tool', 'table_tool']);
  });

  it('sends neither when the skill is not in force', async () => {
    const { model } = await turn([off], [{ text: 'ok' }]);
    expect(systemOf(model)).not.toContain('At the table');
    expect(offeredTo(model)).toEqual(['core_tool']);
  });

  it('answers a call to a tool that is not offered this turn with an error result', async () => {
    const { outcome, reply } = await turn(
      [],
      [{ tool: { name: 'table_tool', input: {} } }, { text: 'ok' }],
    );
    expect(outcome.status).toBe('complete');
    expect(reply?.parts).toContainEqual(
      expect.objectContaining({
        toolName: 'table_tool',
        state: 'output-error',
        errorText: 'That tool is not available right now.',
      }),
    );
  });

  it('survives a call to a tool that does not exist at all', async () => {
    const { outcome } = await turn([], [{ tool: { name: 'made_up', input: {} } }, { text: 'ok' }]);
    expect(outcome.status).toBe('complete');
  });
});
