# Agent Kit

A small framework for agents built on the Vercel AI SDK. It holds everything an agent needs
that is not about its domain. It started in Vino Vibes, where the sommelier was the first
agent built on it, and Fest Vibes' Boomy was the second. In this template `apps/api` uses it,
and `test/example-agent.test.ts` is a complete agent in a single file.

## What it gives you

| Piece                                                                      | What it does                                                                                                                                                               |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defineOperation`, `mountOperations`, `buildTools`, `buildOpenApiDocument` | Define a capability once; get a REST route, an OpenAPI entry, and (if flagged) a tool the model can call                                                                   |
| `chatRoutes`                                                               | `POST /api/chat`: a streaming endpoint with an immediate status event, keep-alives, stop, replay of a retried message, one turn per session, rate limits and budget gating |
| `runTurn`                                                                  | The tool loop: runs to completion even if the client disconnects, stores the reply as complete, stopped or failed, records usage per step, summarises long conversations   |
| `createModelResolver`                                                      | `openai:<id>`, `anthropic:<id>`, or `compatible:<id>` for any OpenAI-compatible server, including a self-hosted open-weight model                                          |
| `costOf`, `capState`, `blockingCap`, money and UTC period helpers          | Spend arithmetic in integer micro-dollars                                                                                                                                  |
| `createLogger`, `createMetrics`, `startTelemetry`                          | JSON logs with trace ids, metrics, tracing                                                                                                                                 |
| `createLimiter`, `createStreamRegistry`, `createShutdown`, `withKeepAlive` | Stream plumbing                                                                                                                                                            |
| `createWorker`, `JobStore`, `Defer`, `Fatal`                               | A job queue: retries with a growing delay, waiting without spending an attempt, one queued job per key, dead jobs kept                                                     |
| `defineWorkflow`, `startRun`, `stopRun`, `workflowHandler`                 | Long work as named steps whose results are saved, so a stopped run carries on from its next step                                                                           |

The kit reads no environment variables and touches no database.

## Building an agent

You supply three things.

**1. Operations**: what the agent can do.

```ts
const addNote = defineOperation<Ctx, typeof Input, Output>({
  id: 'add_note',
  description: 'Save a note for the person.', // the model reads this
  method: 'post',
  path: '/api/notes',
  input: Input, // a flat Zod object
  output: OutputSchema,
  agentTool: true, // false keeps it API-only
  handler: (ctx, input) => notes.add(ctx.userId, input.text),
});
```

**2. An `AgentStore`**: where conversations and usage live, and whether a turn may run. Eight
methods (`src/types.ts`). Every one must scope its work to `ctx.userId`. `checkBudget`
returns which model to use, so plans, caps and model choice are entirely yours.

**3. Prompts and context**: a `PromptSource` (give it to `settings.prompts`) that returns a
prompt by name, and on the agent: `id`, `corePromptName`, and optionally `buildContext`,
which returns the sections that follow the core prompt (what is known about the person).
The kit puts the core first so provider prompt caching applies.

Then wire it:

```ts
const app = createOpenApiApp<Ctx>();
app.use('/api/*', yourAuthMiddleware); // must set c.set('ctx', { userId, logger, ... })
mountOperations(app, operations);
chatRoutes(app, {
  agent: { id: 'notes', operations, store, corePromptName: 'notes/core' },
  settings, // token budgets, timeout, summary model
  resolveModel: createModelResolver({ openaiApiKey, compatible: { baseURL } }),
  streams: createStreamRegistry(),
  limiter: createLimiter({ rpm: 20, maxConcurrent: 2 }),
  keepAliveMs: 15_000,
});
```

## Skills

A skill adds instructions and switches on tools for a situation. The application decides
when it applies:

```ts
const atTheDesk: Skill<Ctx> = {
  id: 'at-the-desk',
  promptName: 'notes/skill/at-the-desk',
  applies: async (ctx) => ({ active: await hasOpenDocument(ctx), facts: { pages: 12 } }),
};
// agent: { ..., skills: [atTheDesk] }
// and on the operations it switches on:  skill: 'at-the-desk'
```

`facts` fill the `{{variables}}` in the skill's prompt. A skill whose check throws is left
out and the turn continues.

## Sub-agents

`runAgent(deps, ctx, { task, model, budget, payer })` runs an agent to completion with no
person on the other end and returns `{ status, stoppedBy, text, steps, costMicroUsd,
toolCalls }`. Call it from a tool's handler to hand work from one agent to another. Steps,
wall time and spend are limited in code; a run that hits a limit returns `partial` with
what it has. A sub-agent cannot start another.

Operations can name the agents allowed to call them (`agents: ['research']`). With no
list, an operation is open to any agent it is handed to.

## Work that happens later

```ts
const readList = defineWorkflow({
  kind: 'read_list',
  run: async (wf, input: { url: string }) => {
    const pages = await wf.step('fetch', () => fetchPages(input.url));
    const parts = [];
    for (const [i, page] of pages.entries()) {
      parts.push(await wf.step(`page:${i + 1}`, (signal) => read(page, signal)));
    }
    return wf.step('store', () => store(parts));
  },
});

const worker = createWorker({
  store: jobs, // a JobStore: yours, or createMemoryJobStore()
  handlers: { [WORKFLOW_JOB]: workflowHandler({ runs }, [readList]) },
  onDead: failRunOfDeadJob(runs),
  logger,
});
await startRun({ jobs, runs }, readList, { url });
worker.start(); // or `await worker.drain()` to work what is due and return
```

A step's result is saved when it finishes; the run's function is called again from the top
each time the run is advanced, and finished steps answer from the save. So: a step may run
twice and must be safe to repeat; it returns plain JSON; code between steps must have no
effects; steps are matched by name. Throw `Defer(until)` from a step to wait without
spending an attempt, `Fatal` when trying again cannot help. `wf.sleep` waits without
holding a worker; `wf.all` runs steps side by side within a limit.

The kit keeps nothing itself: you supply a `JobStore` and a `WorkflowStore`. Run
`jobStoreCases` and `workflowStoreCases` from `@ai-saas/agent-kit/testing` against
yours; the in-memory stores pass the same cases.

## Hooks on a turn

Three optional functions on an agent let it surround the model without the kit knowing
what the agent is for:

- `beforeTurn(ctx, { sessionId, recent })` runs before the model. Return `{ reply }` to
  answer the turn yourself (no model call, nothing spent), or any of `instructions`
  (lines added for this turn), `signals` (facts for skills to read on `ctx.signals`) and
  `maxOutputTokens`. If it throws, the turn goes ahead without it.
- `whileStarting(ctx, turn)` is a second gate for a check too slow to wait for on every
  turn. The model is started at once; none of its reply is shown and none of its tools
  run until this resolves. A reply drops the call; a change to instructions, skills or the
  output limit drops it and makes it again; otherwise the call under way is the turn.
- `replyGuard(text, final)` is called with the whole reply so far before any new text is
  shown. Return `{ cutAt, append }` to stop the model, end the reply there, and say
  `append` instead; or `{ holdFrom }` to keep doubtful text back until more arrives. What
  is stored is exactly what was shown.
- `afterTurn(ctx, report)` is told what happened: the stored reply, what the tools
  returned, and whether the turn was answered by the gate or cut. It cannot fail the turn.

## Rules the kit relies on

- `userId` comes from your auth middleware, never from request input or the model.
- A tool never throws: a failed operation returns `{ error: { code, message } }` to the model.
- Earlier turns are sent to the model as text only; tool payloads from past turns are dropped.
- Limits in `createLimiter` are per process. Spend caps belong in your store, where they can
  be exact.

## Using it from another package in this repo

Depend on `"@ai-saas/agent-kit": "workspace:*"`. In development and tests, resolve the
`ai-saas-source` export condition (see `apps/api/tsconfig.json`, `vitest.config.ts` and the
`tsx --conditions=ai-saas-source` scripts) to run the kit from TypeScript without building it.
Production uses the compiled `dist`, built by `pnpm build`.
