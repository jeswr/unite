import { MAX_SCREENSHOT_CHARS, type Feedback } from '@unite/shared';

/** Zero-width and direction characters, removed so they cannot split an address. */
const INVISIBLE = new RegExp('[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u206F\\uFEFF]', 'g');
/** Control characters other than a new line. */
// eslint-disable-next-line no-control-regex -- control characters are exactly what this removes
const CONTROL = new RegExp('[\\u0000-\\u0009\\u000B-\\u001F\\u007F-\\u009F]', 'g');

/**
 * Takes links and email addresses out of text that may be published. Look-alike characters are
 * normalised first so they cannot slip past. It cannot recognise names: the person sees the exact
 * text before agreeing to it.
 */
export function stripLinksAndEmails(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .replace(CONTROL, ' ')
    .replace(/[^\s@<>()[\]"']+@[^\s@<>()[\]"']+/g, '[email removed]')
    .replace(/\S+\s*[[(]\s*at\s*[\])]\s*\S+/gi, '[email removed]')
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S*/gi, '[link removed]')
    .replace(/(^|[\s(<"'])\/\/\S+/g, '$1[link removed]')
    .replace(/\bwww\.\S*/gi, '[link removed]')
    .replace(/\b(?:[\p{L}\p{N}-]+\.)+(?:com|org|net|io|uk|gov|edu|info|dev|app|co|ai|eu|me)\b(?:\/\S*)?/giu, '[link removed]')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The public summary exactly as it would be published: each answered question and its answer, with links and email addresses taken out. */
export function publicSummaryText(answers: Feedback['answers']): string {
  return answers
    .filter((a) => a.answer.trim())
    .map((a) => `${stripLinksAndEmails(a.question)}\n${stripLinksAndEmails(a.answer)}`)
    .join('\n\n');
}

const SCREENSHOT = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;

/** Checks a screenshot: a PNG or JPEG data URL of at most 400 KB, whose bytes really are that kind of image. Returns a plain reason when it is not. */
export function screenshotProblem(dataUrl: string): string | undefined {
  if (dataUrl.length > MAX_SCREENSHOT_CHARS) return 'The screenshot is too large. It can be at most 400 KB.';
  const m = SCREENSHOT.exec(dataUrl);
  if (!m) return 'The screenshot must be a PNG or JPEG image.';
  const head = Buffer.from(m[2]!.slice(0, 16), 'base64');
  const png = head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpeg = head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if ((m[1] === 'png' && !png) || (m[1] === 'jpeg' && !jpeg)) return 'The screenshot must be a PNG or JPEG image.';
  return undefined;
}

/** One CSV cell: quoted when needed, and never read as a formula by a spreadsheet. */
export function csvCell(v: unknown): string {
  let s = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
