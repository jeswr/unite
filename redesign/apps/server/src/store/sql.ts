import { AsyncLocalStorage } from 'node:async_hooks';
import { COLLECTION_SCHEMAS, type Clock, type CollectionName, type DocOf } from '@unite/shared';
import { type ListOptions, type Queryable, type SqlDriver, type Store, ValidationError, type Where } from './types.js';

/** One SQL dialect for PGlite and Postgres. */
export const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS docs (
    collection text NOT NULL,
    id text NOT NULL,
    data jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    seq bigserial,
    PRIMARY KEY (collection, id)
  )`,
  `CREATE INDEX IF NOT EXISTS docs_data_gin ON docs USING gin (data)`,
  `CREATE INDEX IF NOT EXISTS docs_collection_created ON docs (collection, created_at, seq)`,
];

/** The fields a record's creation time is read from, first found wins; otherwise the clock. */
const CREATED_FIELDS = ['createdAt', 'joinedAt', 'startedAt', 'checkedAt', 'updatedAt'] as const;
const UPDATED_FIELDS = ['updatedAt'] as const;

function firstString(doc: Record<string, unknown>, fields: readonly string[]): string | undefined {
  for (const f of fields) if (typeof doc[f] === 'string') return doc[f] as string;
  return undefined;
}

function checkWhere(where: Where | undefined) {
  for (const [k, v] of Object.entries(where ?? {})) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(k)) throw new Error(`Not a field name: ${k}`);
    if (!['string', 'number', 'boolean'].includes(typeof v)) throw new Error(`Field ${k} must be compared with a string, number or boolean`);
  }
}

/** The document store over a SQL driver. */
export class SqlStore implements Store {
  private readonly als = new AsyncLocalStorage<{ store: SqlStore; q: Queryable }>();

  private constructor(
    private readonly driver: SqlDriver,
    private readonly clock: Clock,
  ) {}

  get kind() {
    return this.driver.kind;
  }

  static async open(driver: SqlDriver, clock: Clock): Promise<SqlStore> {
    for (const stmt of SCHEMA_SQL) await driver.query(stmt);
    return new SqlStore(driver, clock);
  }

  /** The current transaction's connection, or the driver. */
  private q(): Queryable {
    const c = this.als.getStore();
    return c?.store === this ? c.q : this.driver;
  }

  async get<C extends CollectionName>(collection: C, id: string): Promise<DocOf<C> | undefined> {
    const { rows } = await this.q().query<{ data: string }>('SELECT data::text AS data FROM docs WHERE collection = $1 AND id = $2', [collection, id]);
    return rows[0] ? (JSON.parse(rows[0].data) as DocOf<C>) : undefined;
  }

  async put<C extends CollectionName>(collection: C, doc: DocOf<C>): Promise<DocOf<C>> {
    const schema = COLLECTION_SCHEMAS[collection];
    if (!schema) throw new Error(`Unknown collection: ${collection}`);
    const parsed = schema.safeParse(doc);
    if (!parsed.success)
      throw new ValidationError(
        collection,
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    const valid = parsed.data as DocOf<C>;
    const now = this.clock.iso();
    const record = valid as unknown as Record<string, unknown>;
    const createdAt = firstString(record, CREATED_FIELDS) ?? now;
    const updatedAt = firstString(record, UPDATED_FIELDS) ?? now;
    await this.q().query(
      `INSERT INTO docs (collection, id, data, created_at, updated_at) VALUES ($1, $2, $3::jsonb, $4, $5)
       ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
      [collection, record.id as string, JSON.stringify(valid), createdAt, updatedAt],
    );
    return valid;
  }

  async list<C extends CollectionName>(collection: C, where?: Where, opts: ListOptions = {}): Promise<DocOf<C>[]> {
    checkWhere(where);
    const col = opts.orderBy === 'updated_at' ? 'updated_at' : 'created_at';
    const dir = opts.dir === 'desc' ? 'DESC' : 'ASC';
    const params: unknown[] = [collection];
    let sql = 'SELECT data::text AS data FROM docs WHERE collection = $1';
    if (where && Object.keys(where).length) {
      params.push(JSON.stringify(where));
      sql += ` AND data @> $${params.length}::jsonb`;
    }
    sql += ` ORDER BY ${col} ${dir}, seq ${dir}`;
    if (opts.limit !== undefined) {
      params.push(Math.max(0, Math.floor(opts.limit)));
      sql += ` LIMIT $${params.length}`;
    }
    const { rows } = await this.q().query<{ data: string }>(sql, params);
    return rows.map((r) => JSON.parse(r.data) as DocOf<C>);
  }

  async count(collection: CollectionName, where?: Where): Promise<number> {
    checkWhere(where);
    const hasWhere = !!where && Object.keys(where).length > 0;
    const { rows } = await this.q().query<{ n: number }>(
      `SELECT count(*)::int AS n FROM docs WHERE collection = $1${hasWhere ? ' AND data @> $2::jsonb' : ''}`,
      hasWhere ? [collection, JSON.stringify(where)] : [collection],
    );
    return Number(rows[0]?.n ?? 0);
  }

  async delete(collection: CollectionName, id: string): Promise<boolean> {
    const { rows } = await this.q().query<{ id: string }>('DELETE FROM docs WHERE collection = $1 AND id = $2 RETURNING id', [collection, id]);
    return rows.length > 0;
  }

  async transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T> {
    if (this.als.getStore()?.store === this) return fn(this); // already inside one: join it
    return this.driver.transaction((q) => this.als.run({ store: this, q }, () => fn(this)));
  }

  async clear(): Promise<void> {
    await this.q().query('TRUNCATE docs');
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}
