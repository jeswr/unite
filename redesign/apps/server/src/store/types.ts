import type { CollectionName, DocOf } from '@unite/shared';

export type Where = Record<string, string | number | boolean>;

export interface ListOptions {
  orderBy?: 'created_at' | 'updated_at';
  dir?: 'asc' | 'desc';
  limit?: number;
}

/**
 * Every record lives as a JSON document in one table (section 4). Every write is validated
 * against the collection's schema; an invalid document is refused with a ValidationError.
 */
export interface Store {
  readonly kind: 'pglite' | 'postgres';
  get<C extends CollectionName>(collection: C, id: string): Promise<DocOf<C> | undefined>;
  /** Insert or replace. Returns the document as stored (validated). */
  put<C extends CollectionName>(collection: C, doc: DocOf<C>): Promise<DocOf<C>>;
  /**
   * Documents whose top-level fields equal every value in `where`, oldest first unless `opts`
   * says otherwise. Ties keep insertion order.
   */
  list<C extends CollectionName>(collection: C, where?: Where, opts?: ListOptions): Promise<DocOf<C>[]>;
  count(collection: CollectionName, where?: Where): Promise<number>;
  /** True if a document was deleted. */
  delete(collection: CollectionName, id: string): Promise<boolean>;
  /**
   * Runs `fn` in one transaction. Calls made inside it, on `tx` or on this store, however deep,
   * join the transaction. A throw rolls everything back.
   */
  transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T>;
  /** Deletes every document (tests and demo resets). */
  clear(): Promise<void>;
  close(): Promise<void>;
}

/** A write that did not match its collection's schema. */
export class ValidationError extends Error {
  constructor(
    readonly collection: string,
    readonly issues: { path: string; message: string }[],
  ) {
    super(`That could not be saved: ${issues.map((i) => (i.path ? `${i.path} ${i.message}` : i.message)).join('; ')}.`);
    this.name = 'ValidationError';
  }
}

/** What the store needs from a database connection: pg's Pool and client and PGlite all fit. */
export interface Queryable {
  query<R>(sql: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

export interface SqlDriver {
  readonly kind: 'pglite' | 'postgres';
  query: Queryable['query'];
  /** Runs fn on one connection between BEGIN and COMMIT, rolling back if it throws. */
  transaction<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
