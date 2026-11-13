import type { Queryable, SqlDriver } from './types.js';

/** node-postgres, for DATABASE_URL. Loaded only when a database URL is set. */
export async function postgresDriver(connectionString: string): Promise<SqlDriver> {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 });
  // An idle connection the server drops emits 'error' on the pool; unhandled, that would crash the process.
  pool.on('error', (err) => console.warn(`[store] idle connection lost: ${err.message}`));
  return {
    kind: 'postgres',
    query: async <R>(sql: string, params?: unknown[]) => ({ rows: (await pool.query(sql, params)).rows as R[] }),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const q: Queryable = { query: async <R>(sql: string, params?: unknown[]) => ({ rows: (await client.query(sql, params)).rows as R[] }) };
        const out = await fn(q);
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
