import type { z } from 'zod';
import { HttpError } from './errors.js';

/** Parses a request body (or query) with a zod schema, or answers 400 with what was wrong. */
export function parseBody<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const r = schema.safeParse(body ?? {});
  if (r.success) return r.data;
  const issues = r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  throw new HttpError(400, 'invalid', `Some of what was sent is not right: ${issues.map((i) => (i.path ? `${i.path} ${i.message}` : i.message)).join('; ')}.`, issues);
}
