import type { IdPrefix } from './collections.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const ID_LENGTH = 12;

/** A new random id: `<prefix>_<12 url-safe chars>`. */
export function newId(prefix: IdPrefix): string {
  const bytes = new Uint8Array(ID_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ALPHABET[b & 63];
  return `${prefix}_${out}`;
}

/**
 * A fixed id derived from a readable key, for seed data and tests: the same key always gives the
 * same id, so seeding is reproducible. `stableId('per', 'earning/amina')`.
 */
export function stableId(prefix: IdPrefix, key: string): string {
  // Two independent 32-bit FNV-1a hashes give 64 bits, enough for 12 base-64 characters' worth of spread.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    h2 = (h2 ^ (h2 >>> 15)) >>> 0;
  }
  let out = '';
  let a = h1;
  let b = h2;
  for (let i = 0; i < ID_LENGTH; i++) {
    out += ALPHABET[(a ^ (b >>> 3)) & 63];
    a = (Math.imul(a, 0x2c1b3c6d) + i + 0x9e3779b9) >>> 0;
    b = (Math.imul(b ^ (b >>> 13), 0x297a2d39) + 0x85ebca6b) >>> 0;
  }
  return `${prefix}_${out}`;
}

/** Turns words into a url slug: "Riverbend Council" becomes "riverbend-council". */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60) || 'untitled'
  );
}
