import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { Queryable, SqlDriver } from './types.js';

/** PGlite in this process: a folder on disk, or memory when `dataDir` is 'memory'. */
export async function pgliteDriver(dataDir: string): Promise<SqlDriver> {
  if (dataDir !== 'memory') fs.mkdirSync(dataDir, { recursive: true });
  const db = await PGlite.create(dataDir === 'memory' ? undefined : dataDir);
  const wrap = (target: { query: PGlite['query'] }): Queryable => ({
    query: async <R>(sql: string, params?: unknown[]) => ({ rows: (await target.query<R>(sql, params)).rows }),
  });
  const main = wrap(db);
  return {
    kind: 'pglite',
    query: main.query,
    transaction: (fn) => db.transaction((tx) => fn(wrap(tx))),
    close: () => db.close(),
  };
}
