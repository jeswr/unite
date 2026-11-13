import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { newId, type Assembly, type Membership, type Person, type Role } from '@unite/shared';
import type { Deps } from './deps.js';
import { HttpError } from './errors.js';
import type { Store } from './store/types.js';

/**
 * Sessions and roles (section 7). A signed, http-only cookie `unite_sid` holds the person id; the
 * person is created on their first write. A second signed cookie `unite_role` holds `host` or
 * `steward`, set by POST /api/role with the passcode.
 */

export const SID_COOKIE = 'unite_sid';
export const ROLE_COOKIE = 'unite_role';
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const ROLE_MS = 12 * 60 * 60 * 1000;

declare global {
  namespace Express {
    interface Request {
      /** From the session cookie; the person may not exist yet. */
      personId?: string;
      /** Set by requirePerson. */
      person?: Person;
      /** From the role cookie; 'participant' when there is none. */
      role: Role;
    }
  }
}

const cookieOptions = (deps: Pick<Deps, 'config'>, maxAge: number) => ({
  httpOnly: true,
  signed: true,
  sameSite: 'lax' as const,
  secure: deps.config.production,
  path: '/',
  maxAge,
});

/** Reads both cookies. Runs on every request; touches no database. */
export function sessionMiddleware(): RequestHandler {
  return (req, _res, next) => {
    const sid = req.signedCookies?.[SID_COOKIE];
    if (typeof sid === 'string' && /^per_[A-Za-z0-9_-]{12}$/.test(sid)) req.personId = sid;
    const role = req.signedCookies?.[ROLE_COOKIE];
    req.role = role === 'host' || role === 'steward' ? role : 'participant';
    next();
  };
}

/** The current person, if they exist. Never creates one. */
export async function currentPerson(deps: Pick<Deps, 'store'>, req: Request): Promise<Person | undefined> {
  if (req.person) return req.person;
  if (!req.personId) return undefined;
  const p = await deps.store.get('persons', req.personId);
  if (p) req.person = p;
  return p;
}

/** Sets the session cookie to an existing person (used only by the test-only sign-in route). */
export function setSession(deps: Pick<Deps, 'config'>, res: Response, personId: string): void {
  res.cookie(SID_COOKIE, personId, cookieOptions(deps, YEAR_MS));
}

/** Creates a person and sets the session cookie. */
export async function createPerson(deps: Pick<Deps, 'store' | 'clock' | 'config'>, req: Request, res: Response): Promise<Person> {
  const person: Person = { id: newId('per'), createdAt: deps.clock.iso(), isExample: false, about: {}, locale: 'en-GB' };
  await deps.store.put('persons', person);
  res.cookie(SID_COOKIE, person.id, cookieOptions(deps, YEAR_MS));
  req.personId = person.id;
  req.person = person;
  return person;
}

/**
 * Middleware: makes sure there is a person (`req.person`). On a write (any method but GET and
 * HEAD) one is created if there is none; on a read with no person the request is refused.
 */
export function requirePerson(deps: Pick<Deps, 'store' | 'clock' | 'config'>): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (await currentPerson(deps, req)) return next();
    if (req.method === 'GET' || req.method === 'HEAD')
      throw new HttpError(401, 'no_person', 'We do not know who you are yet. Join an assembly or start a conversation first.');
    await createPerson(deps, req, res);
    next();
  };
}

/** Middleware: only these roles may continue. */
export function requireRole(...roles: ('host' | 'steward')[]): RequestHandler {
  return (req, _res, next) => {
    if (!(roles as Role[]).includes(req.role)) {
      const who = roles.length === 2 ? 'hosts and stewards' : roles[0] === 'host' ? 'hosts' : 'stewards';
      throw new HttpError(403, 'role_required', `Only ${who} can do this. Enter the passcode on the ${roles[0]} page first.`);
    }
    next();
  };
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** POST /api/role: sets the role cookie when the passcode matches. */
export function setRole(deps: Pick<Deps, 'config'>, res: Response, role: 'host' | 'steward', code: string): void {
  const expected = role === 'host' ? deps.config.hostCode : deps.config.stewardCode;
  if (!same(code, expected)) throw new HttpError(403, 'wrong_code', 'That passcode is not right.');
  res.cookie(ROLE_COOKIE, role, cookieOptions(deps, ROLE_MS));
}

export function clearRole(deps: Pick<Deps, 'config'>, res: Response): void {
  const { maxAge: _maxAge, ...opts } = cookieOptions(deps, 0);
  void _maxAge;
  res.clearCookie(ROLE_COOKIE, opts);
}

export async function getMembership(store: Store, personId: string | undefined, assemblyId: string): Promise<Membership | undefined> {
  if (!personId) return undefined;
  const [m] = await store.list('memberships', { personId, assemblyId }, { limit: 1 });
  return m;
}

/**
 * Rule 1, heard alone first: true when the person has a completed conversation in this assembly,
 * or chose "Look around the example first" in an example assembly, or is a host or steward.
 */
export async function isHeard(deps: Pick<Deps, 'store'>, assembly: Assembly, personId: string | undefined, role: Role): Promise<boolean> {
  if (role === 'host' || role === 'steward') return true;
  if (!personId) return false;
  const done = await deps.store.count('conversations', { personId, assemblyId: assembly.id, status: 'complete' });
  if (done > 0) return true;
  if (!assembly.isExample) return false;
  const m = await getMembership(deps.store, personId, assembly.id);
  return !!m?.lookedAroundFirst;
}

/** Rule 1 as a guard: throws 403 `not_heard` unless `isHeard`. Use before returning any group content. */
export async function requireHeard(deps: Pick<Deps, 'store'>, req: Request, assembly: Assembly): Promise<void> {
  if (await isHeard(deps, assembly, req.personId, req.role)) return;
  throw new HttpError(
    403,
    'not_heard',
    assembly.isExample
      ? 'Have your own conversation first, or choose to look around the example first.'
      : 'Have your own conversation first. You will see what everyone else said once you have been heard.',
  );
}
