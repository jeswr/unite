// Per-tab session tokens. A token is an opaque random bearer value that the
// browser keeps in sessionStorage; it maps to a participant ID held by the
// store. Tokens never appear in public state, events, exports or logs.
// A display name is a label, not authentication.

import { randomBytes } from 'node:crypto';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export class Sessions {
  constructor({ now = () => Date.now(), idleMs = 12 * 60 * 60 * 1000, max = 1000 } = {}) {
    this.now = now;
    this.idleMs = idleMs;
    this.max = max;
    this.byToken = new Map();
  }

  create(participantId) {
    this.sweep();
    if (this.byToken.size >= this.max) return null;
    const token = randomBytes(32).toString('base64url');
    this.byToken.set(token, { participantId, lastSeen: this.now() });
    return token;
  }

  resolve(token) {
    if (typeof token !== 'string' || !TOKEN.test(token)) return null;
    const session = this.byToken.get(token);
    if (!session) return null;
    if (this.now() - session.lastSeen > this.idleMs) {
      this.byToken.delete(token);
      return null;
    }
    session.lastSeen = this.now();
    return session.participantId;
  }

  sweep() {
    const cutoff = this.now() - this.idleMs;
    for (const [token, session] of this.byToken) {
      if (session.lastSeen < cutoff) this.byToken.delete(token);
    }
  }
}

// Fixed-window counter. Good enough to bound a local demo, not a defence
// against a determined attacker on a shared network.
export class RateLimiter {
  constructor({ limit, windowMs, now = () => Date.now() }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.windows = new Map();
  }

  allow(key) {
    const t = this.now();
    let entry = this.windows.get(key);
    if (!entry || t - entry.start >= this.windowMs) {
      if (this.windows.size > 5000) this.#prune(t);
      entry = { start: t, count: 0 };
      this.windows.set(key, entry);
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  #prune(t) {
    for (const [key, entry] of this.windows) {
      if (t - entry.start >= this.windowMs) this.windows.delete(key);
    }
  }
}
