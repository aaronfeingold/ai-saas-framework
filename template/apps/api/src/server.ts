import {
  createLogger,
  createMetrics,
  createShutdown,
  createStreamRegistry,
} from '@ai-saas/agent-kit';
import { startTelemetry } from '@ai-saas/agent-kit/tracing';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createSupabaseVerifier } from './lib/auth.js';
import { createPool } from './lib/db.js';
import { createFilePromptSource } from './lib/prompts.js';
import { purgeOldSessions } from './services/chat-sessions.js';

const env = loadEnv();
const telemetry = await startTelemetry({
  exporter: env.TELEMETRY_EXPORTER,
  serviceName: 'app-api',
});
const logger = createLogger({ level: env.LOG_LEVEL });
const metrics = createMetrics(telemetry.metricReaders, 'app-api');
const db = createPool(env.DATABASE_URL);
const streams = createStreamRegistry();

const app = createApp({
  env,
  db,
  logger,
  metrics,
  prompts: createFilePromptSource(),
  verifyUser: createSupabaseVerifier(env),
  streams,
});

const keys: Record<string, string | undefined> = {
  openai: env.OPENAI_API_KEY,
  anthropic: env.ANTHROPIC_API_KEY,
};
if (!keys[env.MODEL.split(':')[0] ?? '']) {
  logger.warn(
    { model: env.MODEL },
    'no API key for the model provider: operations work, chat will fail',
  );
}

// Idle sessions go hourly. Every replica does this; the DELETE is idempotent.
const purge = async () => {
  try {
    const deleted = await purgeOldSessions(db, env.SESSION_RETENTION_HOURS);
    if (deleted > 0) logger.info({ deleted }, 'purged old chat sessions');
  } catch (err) {
    logger.error({ err }, 'purging old chat sessions failed');
  }
};
await purge();
const purgeTimer = setInterval(purge, 60 * 60 * 1000);
purgeTimer.unref();

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) =>
  logger.info({ port: info.port }, 'api listening'),
);

const shutdown = createShutdown(server, streams, 20_000);
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    logger.info({ signal }, 'shutting down');
    clearInterval(purgeTimer);
    await shutdown();
    await Promise.allSettled([db.end(), metrics.shutdown(), telemetry.shutdown()]);
    process.exit(0);
  });
}
