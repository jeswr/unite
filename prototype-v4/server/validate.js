// Strict validators for request bodies. Every mutation passes its body
// through `fields()` first, so unknown keys (including "__proto__", which
// JSON.parse creates as an own property) are rejected rather than ignored.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const bad = (message) => new HttpError(400, message);

// C0/C1 controls except tab and newline, plus bidi overrides and isolates,
// which can make text display differently from what it contains.
const FORBIDDEN = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F‪-‮⁦-⁩]/;

export function fields(body, required, optional = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw bad('Request body must be a JSON object.');
  }
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw bad(`Unknown field "${key.slice(0, 40)}".`);
  }
  for (const key of required) {
    if (!Object.hasOwn(body, key)) throw bad(`Missing field "${key}".`);
  }
  return body;
}

export function text(value, { label, min = 1, max, multiline = false }) {
  if (typeof value !== 'string') throw bad(`${label} must be text.`);
  const clean = value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (FORBIDDEN.test(clean)) throw bad(`${label} contains control or direction-override characters.`);
  if (!multiline && clean.includes('\n')) throw bad(`${label} must be a single line.`);
  const length = [...clean].length;
  if (length < min) throw bad(min === 1 ? `${label} cannot be empty.` : `${label} needs at least ${min} characters.`);
  if (length > max) throw bad(`${label} can be at most ${max} characters.`);
  return clean;
}

export function optionalText(value, options) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string' && value.trim() === '') return '';
  return text(value, options);
}

export function oneOf(value, options, label) {
  if (!options.includes(value)) throw bad(`${label} must be one of: ${options.join(', ')}.`);
  return value;
}

export function integer(value, { label, min, max }) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw bad(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

export function boolean(value, label) {
  if (typeof value !== 'boolean') throw bad(`${label} must be true or false.`);
  return value;
}

export function list(value, { label, max }) {
  if (!Array.isArray(value)) throw bad(`${label} must be a list.`);
  if (value.length > max) throw bad(`${label} can have at most ${max} items.`);
  return value;
}

const ID = /^[a-z]{1,4}_[A-Za-z0-9_-]{6,40}$/;
export function id(value, label) {
  if (typeof value !== 'string' || !ID.test(value)) throw bad(`${label} is not a valid identifier.`);
  return value;
}

// A calendar date (YYYY-MM-DD) between `from` and `from + maxDays`, compared
// in UTC so the check does not depend on the server's time zone.
export function dateWithin(value, { label, from, maxDays }) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw bad(`${label} must be a date (YYYY-MM-DD).`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw bad(`${label} is not a real calendar date.`);
  }
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const days = (parsed.getTime() - start) / 86_400_000;
  if (days < 0 || days > maxDays) throw bad(`${label} must be between today and ${maxDays} days from now.`);
  return value;
}
