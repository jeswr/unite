import type { RequestHandler } from 'express';
import { HttpError } from '../errors.js';

/** The answer of every endpoint another part of the build has not filled in yet. */
export const notBuilt: RequestHandler = (req) => {
  throw new HttpError(501, 'not_built', `This part of Unite is still being built (${req.method} ${req.baseUrl}${req.path}).`);
};
