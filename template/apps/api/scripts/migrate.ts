import pg from 'pg';
import { loadEnv } from '../src/config/env.js';
import { applyMigrations } from '../src/lib/migrate.js';

const client = new pg.Client({ connectionString: loadEnv().DATABASE_URL });
await client.connect();
try {
  const applied = await applyMigrations(client);
  console.log(applied.length ? `applied ${applied.join(', ')}` : 'up to date');
} finally {
  await client.end();
}
