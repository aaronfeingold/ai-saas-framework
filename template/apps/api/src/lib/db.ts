import pg from 'pg';

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
}

/** pgvector's text form, for passing an embedding as a query parameter. */
export const toVector = (v: number[]): string => `[${v.join(',')}]`;
