import { randomBytes } from 'node:crypto';
import { createLogger, createMetrics, type ModelResolver } from '@ai-saas/agent-kit';
import { MockLanguageModelV4 } from 'ai/test';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createPool } from '../src/lib/db.js';
import { applyMigrations } from '../src/lib/migrate.js';
import { createFilePromptSource } from '../src/lib/prompts.js';

/**
 * A Postgres that tests may create databases in, e.g. the compose one:
 * postgresql://app:app@127.0.0.1:55435/app. Tests that need it skip without it.
 */
export const ADMIN_URL = process.env.TEST_DATABASE_URL;

/** A fresh database with the API's migrations applied. */
export async function createTestDatabase(): Promise<{ url: string; drop: () => Promise<void> }> {
  if (!ADMIN_URL) throw new Error('TEST_DATABASE_URL is not set');
  const name = `app_api_test_${randomBytes(4).toString('hex')}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  await applyMigrations(client);
  await client.end();

  return {
    url: url.toString(),
    drop: async () => {
      const a = new pg.Client({ connectionString: ADMIN_URL });
      await a.connect();
      await a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await a.end();
    },
  };
}

export type Step = { text?: string; tool?: { name: string; input: unknown } };

/** A model that plays back the given steps, one per call, and reports fixed usage. */
export function scriptedModel(steps: Step[]) {
  let call = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      const step = steps[Math.min(call++, steps.length - 1)] as Step;
      const chunks: unknown[] = [];
      if (step.text) {
        chunks.push(
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: step.text },
          { type: 'text-end', id: 't' },
        );
      }
      if (step.tool) {
        chunks.push({
          type: 'tool-call',
          toolCallId: `c${call}`,
          toolName: step.tool.name,
          input: JSON.stringify(step.tool.input),
        });
      }
      chunks.push({
        type: 'finish',
        finishReason: { unified: step.tool ? 'tool-calls' : 'stop', raw: undefined },
        usage: {
          inputTokens: { total: 2000, noCache: 2000, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 100, text: 100, reasoning: undefined },
        },
      });
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const c of chunks) controller.enqueue(c as never);
            controller.close();
          },
        }),
      };
    },
  });
}

/** Test tokens: `token-<name>` signs in as `user-<name>`; anything else is rejected. */
export const tokenFor = (user: string) => `token-${user.replace(/^user-/, '')}`;

/** The app over a test database, with stub sign-in and, for chat, a scripted model. */
export function testApp(
  databaseUrl: string,
  opts: { model?: MockLanguageModelV4; env?: Record<string, string> } = {},
) {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    LOG_LEVEL: 'silent',
    ...opts.env,
  });
  const db = createPool(databaseUrl);
  const resolveModel: ModelResolver = () => {
    if (!opts.model) throw new Error('this test has no model');
    return opts.model;
  };
  const app = createApp({
    env,
    db,
    logger: createLogger({ level: process.env.TEST_LOG_LEVEL ?? 'silent' }),
    metrics: createMetrics([], 'test'),
    prompts: createFilePromptSource(),
    verifyUser: async (token) => (token.startsWith('token-') ? `user-${token.slice(6)}` : null),
    resolveModel,
  });
  return { app, db };
}
