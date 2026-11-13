import type { Feedback } from '@unite/shared';
import type { Config } from '../../config.js';

/** How long one Blob write may take before it is given up. */
export const ARCHIVE_TIMEOUT_MS = 10_000;

/** The Blob pathname for one copy of a record: `unite-feedback/<ISO timestamp>-<id>.json`. */
export const archivePath = (fb: Pick<Feedback, 'id'>, at: string) => `unite-feedback/${at}-${fb.id}.json`;

/**
 * A durable copy of sent feedback for a deployment with no database (the Vercel demo): when
 * BLOB_READ_WRITE_TOKEN is set, the record is also written to Vercel Blob as a private JSON file.
 * The private token (the only key to the record) is left out. Fire-and-forget: it never throws,
 * never delays the response, and gives up after ARCHIVE_TIMEOUT_MS; a failure is only logged.
 * Returns the write so tests (and Vercel's waitUntil) can wait for it.
 */
export function archiveFeedback(config: Pick<Config, 'blobToken'>, fb: Feedback, at: string): Promise<void> | undefined {
  if (!config.blobToken) return undefined;
  const { token: _token, ...record } = fb;
  void _token;
  const pathname = archivePath(fb, at);
  const write = (async () => {
    try {
      const { put } = await import('@vercel/blob');
      const abort = new AbortController();
      let timer: NodeJS.Timeout | undefined;
      // The abort signal alone is not enough: the Blob client retries, and was seen to hang past it.
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          abort.abort();
          reject(new Error(`gave up after ${ARCHIVE_TIMEOUT_MS / 1000} seconds`));
        }, ARCHIVE_TIMEOUT_MS);
        timer.unref?.();
      });
      const body = JSON.stringify({ archivedAt: at, ...record }, null, 2);
      const upload = put(pathname, body, {
        access: 'private',
        contentType: 'application/json',
        allowOverwrite: true,
        token: config.blobToken,
        abortSignal: abort.signal,
      });
      upload.catch(() => {}); // a late failure after the timeout is not unhandled
      try {
        await Promise.race([upload, timeout]);
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      console.error(`[feedback] could not keep a copy in Vercel Blob at ${pathname}:`, err instanceof Error ? err.message : err);
    }
  })();
  keepAlive(write);
  return write;
}

/** On Vercel, asks the platform to keep the function running until the write ends (what @vercel/functions' waitUntil does). */
function keepAlive(p: Promise<void>): void {
  const ctx = (globalThis as Record<symbol, { get?: () => { waitUntil?: (p: Promise<unknown>) => void } | undefined } | undefined>)[
    Symbol.for('@vercel/request-context')
  ];
  ctx?.get?.()?.waitUntil?.(p);
}
