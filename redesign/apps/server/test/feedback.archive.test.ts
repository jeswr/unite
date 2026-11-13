import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const put = vi.fn();
vi.mock('@vercel/blob', () => ({ put: (...args: unknown[]) => put(...args) }));

const { archiveFeedback, ARCHIVE_TIMEOUT_MS } = await import('../src/services/feedback/archive.js');
const { testEnv } = await import('./helpers.js');
type TestEnv = Awaited<ReturnType<typeof testEnv>>;

let env: TestEnv;
afterEach(async () => {
  put.mockReset();
  vi.restoreAllMocks();
  await env?.close();
});

async function sendFeedback() {
  const started = await request(env.app).post('/api/feedback').send({ path: '/register', mode: 'free' });
  expect(started.status).toBe(201);
  const token = started.body.token as string;
  return { token, sent: await request(env.app).post(`/api/feedback/${token}/submit`) };
}

describe('feedback copies in Vercel Blob', () => {
  describe('with BLOB_READ_WRITE_TOKEN', () => {
    beforeEach(async () => {
      env = await testEnv({ config: { blobToken: 'vercel_blob_rw_test' } });
    });

    it('writes each sent record as a private JSON file, without the private token', async () => {
      put.mockResolvedValue({ pathname: 'x' });
      const { token, sent } = await sendFeedback();
      expect(sent.status).toBe(200);
      await vi.waitFor(() => expect(put).toHaveBeenCalledTimes(1));
      const [pathname, body, opts] = put.mock.calls[0]!;
      const [fb] = await env.deps.store.list('feedback');
      expect(pathname).toMatch(new RegExp(`^unite-feedback/\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d\\.\\d{3}Z-${fb!.id}\\.json$`));
      expect(opts).toMatchObject({ access: 'private', contentType: 'application/json', token: 'vercel_blob_rw_test' });
      expect(opts.abortSignal).toBeInstanceOf(AbortSignal);
      const record = JSON.parse(body as string);
      expect(record).toMatchObject({ id: fb!.id, path: '/register', mode: 'free', status: 'received' });
      expect(record.token).toBeUndefined();
      expect(body).not.toContain(token);
    });

    it('keeps a new copy when a sent record is changed, but not while it is a draft', async () => {
      put.mockResolvedValue({});
      const started = await request(env.app).post('/api/feedback').send({ mode: 'free' });
      const token = started.body.token as string;
      await request(env.app).patch(`/api/feedback/${token}`).send({ name: 'Sam' });
      expect(put).not.toHaveBeenCalled();
      await request(env.app).post(`/api/feedback/${token}/submit`);
      await request(env.app).patch(`/api/feedback/${token}`).send({ contact: 'sam@example.org' });
      await vi.waitFor(() => expect(put).toHaveBeenCalledTimes(2));
      expect(JSON.parse(put.mock.calls[1]![1] as string)).toMatchObject({ name: 'Sam', contact: 'sam@example.org' });
    });

    it('never fails or delays sending when Blob fails or hangs', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      put.mockRejectedValueOnce(new Error('store is down'));
      const first = await sendFeedback();
      expect(first.sent.status).toBe(200);
      expect(first.sent.body.feedback.status).toBe('received');
      await vi.waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringContaining('could not keep a copy'), 'store is down'));

      put.mockImplementationOnce(() => new Promise(() => {})); // never answers
      const t0 = Date.now();
      const second = await sendFeedback();
      expect(second.sent.status).toBe(200);
      expect(Date.now() - t0).toBeLessThan(ARCHIVE_TIMEOUT_MS);
    });
  });

  it('gives up on a write that hangs, aborting it and logging why', async () => {
    env = await testEnv();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    put.mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();
    try {
      const write = archiveFeedback({ blobToken: 't' }, { id: 'fb_x', token: 'secret' } as never, '2026-11-13T09:00:00.000Z')!;
      await vi.waitFor(() => expect(put).toHaveBeenCalled());
      await vi.advanceTimersByTimeAsync(ARCHIVE_TIMEOUT_MS);
      await write;
    } finally {
      vi.useRealTimers();
    }
    expect(put.mock.calls[0]![0]).toBe('unite-feedback/2026-11-13T09:00:00.000Z-fb_x.json');
    expect((put.mock.calls[0]![2] as { abortSignal: AbortSignal }).abortSignal.aborted).toBe(true);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('could not keep a copy'), 'gave up after 10 seconds');
  });

  it('does nothing without the token', async () => {
    env = await testEnv();
    const { sent } = await sendFeedback();
    expect(sent.status).toBe(200);
    expect(put).not.toHaveBeenCalled();
    expect(archiveFeedback({}, { id: 'fb_x' } as never, new Date().toISOString())).toBeUndefined();
  });
});
