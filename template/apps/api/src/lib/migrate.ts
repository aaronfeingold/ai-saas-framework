import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
/** `apps/api/migrations`: two folders up from source, three from the build output. */
export const MIGRATIONS_DIR =
  ['../../migrations', '../../../migrations']
    .map((up) => path.resolve(here, up))
    .find((dir) => existsSync(dir)) ?? path.resolve(here, '../../migrations');

/** Apply migrations/*.sql in name order, each once and in its own transaction. */
export async function applyMigrations(
  client: pg.Client,
  dir: string = MIGRATIONS_DIR,
): Promise<string[]> {
  // The API's tables, and the bookkeeping, live in the app schema.
  await client.query('CREATE SCHEMA IF NOT EXISTS app');
  await client.query(
    'CREATE TABLE IF NOT EXISTS app.schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const done = new Set(
    (await client.query<{ name: string }>('SELECT name FROM app.schema_migrations')).rows.map(
      (r) => r.name,
    ),
  );
  const applied: string[] = [];
  for (const name of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(name)) continue;
    await client.query('BEGIN');
    try {
      await client.query(await readFile(path.join(dir, name), 'utf8'));
      await client.query('INSERT INTO app.schema_migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      applied.push(name);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }
  return applied;
}
