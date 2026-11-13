/** A small stop list: words too common to show that two texts say the same thing. */
export const STOP_WORDS: ReadonlySet<string> = new Set(
  (
    'a an the and or but if then so of to in on at by for with from as is am are was were be been being ' +
    'it its this that these those there here i me my mine we us our you your he him his she her they them their ' +
    'do does did done have has had not no yes just very really too also can could would should will shall may might must ' +
    'what which who whom when where why how all any some more most such only own same than up down out over about into ' +
    'im ive id dont didnt cant wont isnt its thats theres'
  ).split(/\s+/),
);

/** Lower-cased words with punctuation removed (apostrophes inside words are dropped: "don't" is "dont"). */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** The words of `text` that carry meaning: `words(text)` without the stop list. */
export function contentWords(text: string): string[] {
  return words(text).filter((w) => !STOP_WORDS.has(w));
}

/**
 * The share of the content words of `a` that are found in `b`, from 0 to 1. Used to check that a
 * point is built from the person's own phrases. Text with no content words scores 0.
 */
export function wordOverlap(a: string, b: string | string[]): number {
  const mine = contentWords(a);
  if (mine.length === 0) return 0;
  const theirs = new Set(contentWords(Array.isArray(b) ? b.join(' ') : b));
  const found = mine.filter((w) => theirs.has(w)).length;
  return found / mine.length;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A date in words, British style, read in UTC: "18 December 2026". */
export function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
