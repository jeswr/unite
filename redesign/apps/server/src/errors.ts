import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from './store/types.js';

/**
 * An error the API answers with `{ error: { code, message } }`. Messages are plain English, for the
 * person reading them.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (what = 'That') => new HttpError(404, 'not_found', `${what} could not be found.`);

/** Express's last middleware: turns any error into the JSON error shape. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  void _next;
  if (err instanceof HttpError) {
    return void res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) } });
  }
  if (err instanceof ValidationError) {
    return void res.status(400).json({ error: { code: 'invalid', message: err.message, details: err.issues } });
  }
  const e = err as { status?: number; type?: string; message?: string };
  if (e?.type === 'entity.parse.failed') {
    return void res.status(400).json({ error: { code: 'bad_json', message: 'The request could not be read. Please try again.' } });
  }
  if (e?.type === 'entity.too.large') {
    return void res.status(413).json({ error: { code: 'too_large', message: 'That is too large to send.' } });
  }
  console.error(`[${req.method} ${req.path}]`, err);
  res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } });
}
