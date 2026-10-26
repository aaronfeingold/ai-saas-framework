import {
  buildOpenApiDocument,
  chatRoutes,
  createLimiter,
  createModelResolver,
  createOpenApiApp,
  createStreamRegistry,
  type Metrics,
  type ModelResolver,
  mountOperations,
  type PromptSource,
  type StreamRegistry,
} from '@ai-saas/agent-kit';
import { cors } from 'hono/cors';
import type { Pool } from 'pg';
import type { Logger } from 'pino';
import { createAssistant, turnSettings } from './agent/assistant.js';
import type { Env } from './config/env.js';
import type { UserVerifier } from './lib/auth.js';
import type { Ctx } from './lib/ctx.js';
import { createOperations } from './operations/index.js';

export type AppDeps = {
  env: Env;
  db: Pool;
  logger: Logger;
  metrics: Metrics;
  prompts: PromptSource;
  /** Turns a bearer token into a user id; Supabase in production, a stub in tests. */
  verifyUser: UserVerifier;
  /** Defaults to the providers configured in `env`; tests pass a mock model. */
  resolveModel?: ModelResolver;
  streams?: StreamRegistry;
};

export const OPENAPI_INFO = {
  title: 'App API',
  version: '0.1.0',
  description:
    "The app's operations and its assistant. Send the signed-in user's Supabase access token as a bearer token.",
};

export function createApp(deps: AppDeps) {
  const { env, metrics } = deps;
  const operations = createOperations(env);
  const app = createOpenApiApp<Ctx>({
    onUnexpectedError: (err, path) => deps.logger.error({ err, path }, 'unexpected error'),
  });

  app.use(
    '*',
    cors({
      origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
      allowHeaders: ['content-type', 'authorization'],
    }),
  );

  // Latency per route, for the p50/p90 dashboards and alerts.
  app.use('*', async (c, next) => {
    const started = performance.now();
    await next();
    metrics.httpRequest(c.req.routePath, c.res.status, performance.now() - started);
  });

  app.get('/healthz', (c) => c.json({ ok: true }));
  app.get('/metrics', async (c) => c.text(await metrics.render()));
  app.get('/openapi.json', (c) => c.json(buildOpenApiDocument(operations, OPENAPI_INFO)));

  // Every /api route is for a signed-in user.
  app.use('/api/*', async (c, next) => {
    const token = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
    const userId = token ? await deps.verifyUser(token) : null;
    if (!userId) {
      return c.json({ error: { code: 'unauthorized', message: 'Sign in to continue' } }, 401);
    }
    c.set('ctx', {
      userId,
      logger: deps.logger.child({ userId }),
      db: deps.db,
    });
    await next();
  });

  // Requests per minute per user. The spend caps in Postgres are the real bound; this keeps
  // one client from using them up in a burst.
  const perUser = createLimiter({
    rpm: env.CHAT_RPM_PER_USER,
    maxConcurrent: Number.MAX_SAFE_INTEGER,
  });
  app.use('/api/chat', async (c, next) => {
    const slot = perUser.enter(c.get('ctx').userId);
    if (!slot.ok) {
      c.header('retry-after', String(slot.retryAfterSec));
      return c.json({ error: { code: 'rate_limited', message: 'Too many requests' } }, 429);
    }
    slot.leave();
    await next();
  });

  mountOperations(app, operations);

  chatRoutes(app, {
    agent: createAssistant(env, operations),
    settings: turnSettings(env, deps.prompts),
    resolveModel:
      deps.resolveModel ??
      createModelResolver({
        openaiApiKey: env.OPENAI_API_KEY,
        anthropicApiKey: env.ANTHROPIC_API_KEY,
      }),
    metrics,
    streams: deps.streams ?? createStreamRegistry(),
    limiter: createLimiter({
      rpm: env.CHAT_RPM_PER_USER,
      maxConcurrent: env.CHAT_CONCURRENT_PER_USER,
    }),
    keepAliveMs: 15_000,
  });

  return app;
}
