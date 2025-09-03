import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool as PgPool } from 'pg';
import * as schema from './schema';

// Use regular pg driver in test environment to avoid WebSocket issues
const isTest = process.env.NODE_ENV === 'test';

let pool: PgPool;
let db: ReturnType<typeof drizzlePg> | ReturnType<typeof drizzle>;

if (isTest) {
  pool = new PgPool({ connectionString: process.env.DATABASE_URL });
  db = drizzlePg(pool, { schema });
} else {
  const _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(_pool, { schema });
  pool = _pool;
}

pool.on('error', (err) => {
  // During teardown/branch deletion in tests, Neon may drop connections.
  // TODO: This is a hack, figure out how to wait for the pool to end first.
  if (err?.message?.includes('Connection terminated unexpectedly')) return;

  // Log anything else; don't crash.
  console.error('pg Pool error:', err);
});

export { db, pool };
