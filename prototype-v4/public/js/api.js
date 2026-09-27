// Talking to the local server. The session token lives in this tab's
// sessionStorage only, so each tab is its own participant.

const TOKEN_KEY = 'unite.v4.session';

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export const tabStore = {
  get(key) {
    try {
      return storage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      storage()?.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      storage()?.removeItem(key);
    } catch {
      // nothing to remove
    }
  },
};

export const token = {
  get: () => tabStore.get(TOKEN_KEY),
  set: (value) => tabStore.set(TOKEN_KEY, value),
  clear: () => tabStore.remove(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const headers = { 'X-Unite-Client': '1' };
  const current = token.get();
  if (current) headers['X-Unite-Session'] = current;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      cache: 'no-store',
      credentials: 'same-origin',
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Could not reach the local Unite server. Is it still running?', 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status}).`, res.status, data?.code);
  return data;
}

export const post = (path, body = {}, options = {}) => api(path, { method: 'POST', body, ...options });

// Live updates, without exhausting the browser's connection pool. Browsers
// allow about six HTTP/1.1 connections per host, shared by every tab, and
// each open event stream holds one. So:
// - a hidden tab closes its stream;
// - a visible window that has not had focus for a while switches to short
//   polls of /api/rev;
// - a stream that cannot open in time (the pool is full) also falls back to
//   polling.
// Focus or visibility brings the stream back. Every (re)connect or poll
// reports the current revision, so the app refetches anything it missed.
export const LIVE_TIMING = { openTimeoutMs: 6000, blurGraceMs: 20_000, pollMs: 3000, retryMs: 5000 };

function browserEnv() {
  return {
    doc: document,
    win: window,
    EventSourceImpl: EventSource,
    fetchRev: () => api('/api/rev'),
    timing: LIVE_TIMING,
  };
}

export function connectLive({ onSync, onStatus, env = browserEnv() }) {
  const { doc, win, EventSourceImpl, fetchRev, timing } = env;
  let mode = null; // 'stream' | 'poll' | 'paused'
  let generation = 0; // ignores callbacks from a mode that has ended
  let source = null;
  let pollStatus = 'polling';
  const timers = { open: null, retry: null, blur: null, poll: null };

  const stop = () => {
    generation += 1;
    source?.close();
    source = null;
    clearTimeout(timers.open);
    clearTimeout(timers.retry);
    clearTimeout(timers.blur);
    clearInterval(timers.poll);
  };

  const sync = (data) => {
    try {
      onSync(typeof data === 'string' ? JSON.parse(data) : data);
    } catch {
      // ignore malformed frames
    }
  };

  const check = async () => {
    const mine = generation;
    try {
      const data = await fetchRev();
      if (mine !== generation) return;
      sync(data);
      onStatus(pollStatus);
    } catch {
      if (mine === generation) onStatus('offline');
    }
  };

  const poll = (status) => {
    stop();
    mode = 'poll';
    pollStatus = status;
    onStatus(status);
    check();
    timers.poll = setInterval(check, timing.pollMs);
  };

  const stream = () => {
    stop();
    mode = 'stream';
    const mine = generation;
    onStatus('connecting');
    source = new EventSourceImpl('/api/events');
    timers.open = setTimeout(() => poll('limited'), timing.openTimeoutMs);
    source.addEventListener('open', () => {
      if (mine !== generation) return;
      clearTimeout(timers.open);
      onStatus('live');
    });
    source.addEventListener('sync', (event) => {
      if (mine === generation) sync(event.data);
    });
    source.addEventListener('error', () => {
      if (mine !== generation) return;
      if (source.readyState === 2) { // CLOSED: the browser gave up
        clearTimeout(timers.open);
        onStatus('offline');
        timers.retry = setTimeout(stream, timing.retryMs);
      } else {
        onStatus('reconnecting');
      }
    });
    if (!doc.hasFocus()) startBlurTimer();
  };

  function startBlurTimer() {
    clearTimeout(timers.blur);
    timers.blur = setTimeout(() => {
      if (mode === 'stream' && !doc.hidden && !doc.hasFocus()) poll('polling');
    }, timing.blurGraceMs);
  }

  const pause = () => {
    stop();
    mode = 'paused';
    onStatus('paused');
  };

  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) pause();
    else if (mode === 'paused') stream();
  });
  win.addEventListener('focus', () => {
    clearTimeout(timers.blur);
    if (!doc.hidden && mode !== 'stream') stream();
  });
  win.addEventListener('blur', () => {
    if (mode === 'stream') startBlurTimer();
  });

  if (doc.hidden) pause();
  else stream();
  return { get mode() { return mode; }, stop };
}
