import { useCallback, useState } from 'react';
import { ApiError } from '../../lib/api';

export const NOT_SWITCHED_ON = 'This part is not switched on yet.';

/** The message to show for a failed call, in plain words. A 501 means another part is not built yet. */
export function messageOf(e: unknown): string {
  if (e instanceof ApiError) return e.status === 501 ? NOT_SWITCHED_ON : e.message;
  return 'That did not work. Please try again.';
}

/** Runs one action at a time, keeping its error (and the error's details) for the form to show. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [details, setDetails] = useState<unknown>();
  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(undefined);
    setDetails(undefined);
    try {
      return await fn();
    } catch (e) {
      setError(messageOf(e));
      setDetails(e instanceof ApiError ? e.details : undefined);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, details, run, setError };
}
