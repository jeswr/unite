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

// Live updates. The server sends the current revision on every (re)connect,
// so nothing is missed while the connection was down.
export function connectLive({ onSync, onStatus }) {
  let source = null;
  const open = () => {
    source = new EventSource('/api/events');
    source.addEventListener('open', () => onStatus('live'));
    source.addEventListener('sync', (event) => {
      try {
        onSync(JSON.parse(event.data));
      } catch {
        // ignore malformed frames
      }
    });
    source.addEventListener('error', () => {
      if (source.readyState === EventSource.CLOSED) {
        onStatus('offline');
        setTimeout(open, 5000);
      } else {
        onStatus('reconnecting');
      }
    });
  };
  open();
}
