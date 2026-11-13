import type { Objection, Report } from '@unite/shared';

/*
 * Reading responses from endpoints that other parts of the build own. The spec names the
 * endpoints but not every response shape, so these read the likely shapes and ignore the rest.
 */

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object';
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

export interface StatementLite {
  id: string;
  text: string;
  status?: string;
}

/** GET /api/assemblies/:slug/statements: `{ statements: (Statement | { statement: Statement })[] }`. */
export function statementsOf(body: unknown): StatementLite[] {
  const list = isObj(body) ? arr(body.statements) : arr(body);
  return list
    .map((x) => (isObj(x) && isObj(x.statement) ? x.statement : x))
    .filter((s): s is Obj => isObj(s) && typeof s.id === 'string' && typeof s.text === 'string')
    .map((s) => ({ id: s.id as string, text: s.text as string, ...(typeof s.status === 'string' ? { status: s.status } : {}) }));
}

/** GET /api/statements/:id: objections at the top level or under `statement`. */
export function objectionsOf(body: unknown): Objection[] {
  if (!isObj(body)) return [];
  const list = arr(body.objections).length ? arr(body.objections) : isObj(body.statement) ? arr(body.statement.objections) : [];
  return list.filter((o): o is Objection => isObj(o) && typeof o.id === 'string' && typeof o.text === 'string');
}

/** GET /api/assemblies/:slug/reports: `{ reports: Report[] }`. */
export function reportsOf(body: unknown): Report[] {
  const list = isObj(body) ? arr(body.reports) : arr(body);
  return list.filter((r): r is Report => isObj(r) && typeof r.id === 'string' && typeof r.status === 'string');
}

/** GET /api/assemblies/:slug/priorities: the ranked statement ids, in order. */
export function rankedIdsOf(body: unknown): string[] {
  if (!isObj(body)) return [];
  const list = arr(body.ranked).length ? arr(body.ranked) : arr(body.ranking).length ? arr(body.ranking) : arr(body.priorities);
  return list
    .map((x) => (typeof x === 'string' ? x : isObj(x) ? (x.statementId ?? x.id ?? (isObj(x.statement) ? x.statement.id : undefined)) : undefined))
    .filter((id): id is string => typeof id === 'string');
}
