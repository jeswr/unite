// Vercel function (Node runtime): POST /api/feedback
// Validates size, adds a timestamp, page and user agent, and stores the JSON in Vercel Blob
// when BLOB_READ_WRITE_TOKEN is set. Without the token it answers 503 so the page can offer to copy the text.
import { put as blobPut } from '@vercel/blob';

export const MAX_BYTES = 20 * 1024;

/** Swappable for tests. */
export const deps = { put: blobPut, now: () => new Date(), random: () => Math.random().toString(36).slice(2, 10) };

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return req.body;
    if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
    return JSON.stringify(req.body);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES) throw Object.assign(new Error('too large'), { code: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : undefined);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    return send(res, 405, { ok: false, error: 'Use POST.' });
  }
  let raw;
  try {
    raw = await readBody(req);
  } catch (e) {
    if (e && e.code === 413) return send(res, 413, { ok: false, error: 'Feedback must be under 20 KB.' });
    return send(res, 400, { ok: false, error: 'Could not read the request.' });
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_BYTES) return send(res, 413, { ok: false, error: 'Feedback must be under 20 KB.' });

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return send(res, 400, { ok: false, error: 'Send JSON.' });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return send(res, 400, { ok: false, error: 'Send a JSON object.' });

  const answers =
    data.answers && typeof data.answers === 'object' && !Array.isArray(data.answers)
      ? Object.fromEntries(Object.entries(data.answers).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k.slice(0, 40), v.slice(0, 4000)]))
      : undefined;
  const message = str(data.message, 8000);
  if (!message?.trim() && !(answers && Object.values(answers).some((v) => v.trim()))) {
    return send(res, 400, { ok: false, error: 'Nothing to send.' });
  }

  const now = deps.now();
  const record = {
    receivedAt: now.toISOString(),
    kind: data.kind === 'guided' ? 'guided' : 'free',
    partial: data.partial === true,
    page: str(data.page, 300) ?? null,
    userAgent: str(req.headers?.['user-agent'], 400) ?? null,
    answers,
    message,
    name: str(data.name, 200),
    email: str(data.email, 320),
  };

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return send(res, 503, { ok: false, error: 'Feedback storage is not configured.' });
  }

  const path = `common-picture-feedback/${now.toISOString().replace(/[:.]/g, '-')}-${deps.random()}.json`;
  try {
    await deps.put(path, JSON.stringify(record, null, 2), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
  } catch {
    return send(res, 502, { ok: false, error: 'Could not store feedback.' });
  }
  return send(res, 200, { ok: true });
}
