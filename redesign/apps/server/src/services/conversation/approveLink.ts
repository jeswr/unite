import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Conversation } from '@unite/shared';
import type { Deps } from '../../deps.js';

/**
 * The one-time link for the host route (section 6.2): a host or steward enters draft points on
 * someone's behalf, and that person approves them by opening `/approve/<token>`.
 *
 * No schema change is needed. The token is derived, never stored: an HMAC of the conversation id
 * (itself 72 random bits that only the host who created it ever sees) keyed with the server's
 * secret. It cannot be worked out from the conversation id without the secret, and it stops
 * working as soon as the conversation is no longer waiting for approval, which makes it one-time.
 */
export function approveToken(deps: Pick<Deps, 'config'>, conversationId: string): string {
  return createHmac('sha256', deps.config.secret).update(`approve:${conversationId}`).digest('base64url').slice(0, 32);
}

export function approvePath(deps: Pick<Deps, 'config'>, conversationId: string): string {
  return `/approve/${approveToken(deps, conversationId)}`;
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The host-route conversation still waiting for approval whose token this is, if any. */
export async function findByToken(deps: Pick<Deps, 'store' | 'config'>, token: string): Promise<Conversation | undefined> {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return undefined;
  const waiting = await deps.store.list('conversations', { route: 'host', status: 'reviewing' });
  return waiting.find((c) => same(approveToken(deps, c.id), token));
}
