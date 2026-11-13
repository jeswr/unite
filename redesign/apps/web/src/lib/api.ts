import { useCallback, useEffect, useState } from 'react';
import type { ApiErrorBody } from '@unite/shared';

/** An error from the API, with its plain-English message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = path.startsWith('/api/') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'offline', 'Unite could not be reached. Check your connection and try again.');
  }
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const err = (data as Partial<ApiErrorBody> | undefined)?.error;
    throw new ApiError(res.status, err?.code ?? 'error', err?.message ?? FALLBACK_MESSAGE, err?.details);
  }
  return data as T;
}

/** Typed calls to the API. Paths may be given with or without the leading `/api`. */
export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export interface ApiState<T> {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
  reload: () => void;
}

/**
 * Fetches `path` (nothing when it is null) and fetches it again whenever `refreshKey` changes,
 * for example the version from `useLive`. Earlier data stays shown while a refetch runs.
 */
export function useApi<T>(path: string | null, refreshKey?: unknown): ApiState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError>();
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (path === null) return;
    let live = true;
    setLoading(true);
    api
      .get<T>(path)
      .then((d) => {
        if (!live) return;
        setData(d);
        setError(undefined);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof ApiError ? e : new ApiError(0, 'error', FALLBACK_MESSAGE));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [path, refreshKey, tick]);
  return { data, error, loading, reload };
}
