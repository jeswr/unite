import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Changes from '../pages/feedback/Changes';
import Feedback from '../pages/feedback/Feedback';
import { FeedbackAdmin } from '../pages/feedback/FeedbackAdmin';
import FeedbackStatus from '../pages/feedback/FeedbackStatus';
import type { FeedbackView, StewardFeedbackList } from '@unite/shared';

const TOKEN = 'tok_abcdefghijklmnopqrstuvwxyz012345';

const view = (over: Partial<FeedbackView> = {}): FeedbackView => ({
  token: TOKEN,
  path: '/register',
  mode: 'free',
  messages: [{ role: 'interviewer', text: 'Thank you. Say as much or as little as you like.\n\nWhat would you like to tell us about Unite?' }],
  answers: [{ key: 'free', question: 'What would you like to tell us about Unite?', answer: '' }],
  status: 'draft',
  statusLabel: 'Not sent yet',
  statusText: 'You have not sent this yet.',
  publicIssue: { state: 'none' },
  createdAt: '2026-11-13T09:00:00.000Z',
  done: false,
  ...over,
});

type Handler = (body: unknown) => unknown;
interface Call {
  method: string;
  url: string;
  body: unknown;
}

/** A fake fetch: routes "METHOD /path" to a handler and records every call. */
function mockApi(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url: String(url), body });
      const handler = routes[`${method} ${url}`];
      if (!handler) return new Response(JSON.stringify({ error: { code: 'not_found', message: 'Not here.' } }), { status: 404 });
      const out = handler(body);
      if (out instanceof Response) return out;
      return new Response(JSON.stringify(out), { status: 200 });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/feedback/:token" element={<FeedbackStatus />} />
        <Route path="/changes" element={<Changes />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('feedback page', () => {
  it('offers three clearly worded ways in, and says which page it is about', async () => {
    const calls = mockApi({ 'POST /api/feedback': () => ({ token: TOKEN, question: 'q', feedback: view() }) });
    renderAt('/feedback?from=%2Fregister');
    expect(screen.getByRole('heading', { level: 1, name: 'Give feedback' })).toBeTruthy();
    expect(screen.getByText('About:').textContent).toContain('/register');
    for (const label of ['Answer a few questions, about eight minutes', 'Just tell us something', 'See what has changed and tell us what you think'])
      expect(screen.getByRole('button', { name: label })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Just tell us something' }));
    expect(await screen.findByText(/What would you like to tell us about Unite\?/)).toBeTruthy();
    expect(calls[0]).toMatchObject({ method: 'POST', url: '/api/feedback', body: { path: '/register', mode: 'free' } });
    expect(screen.getByRole('heading', { level: 1, name: 'Tell us something' })).toBeTruthy();
    // The chat announces new turns politely; there is no microphone where the browser cannot listen.
    expect(document.querySelector('ol[aria-live="polite"]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Speak instead' })).toBeNull();
    // The private link is there from the start.
    expect((screen.getByLabelText('The link') as HTMLInputElement).value).toContain(`/feedback/${TOKEN}`);
    expect(screen.getByRole('button', { name: 'Copy the link' })).toBeTruthy();
  });

  it('starts in the changes mode straight from the changes page link', async () => {
    const calls = mockApi({ 'POST /api/feedback': () => ({ token: TOKEN, question: 'q', feedback: view({ mode: 'changes' }) }) });
    renderAt('/feedback?mode=changes&since=0.1.0');
    expect(await screen.findByRole('heading', { level: 1, name: 'What has changed' })).toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ path: '/', mode: 'changes', sinceVersion: '0.1.0' });
  });

  it('records answers, lets them be edited in place, and submits what has been said so far', async () => {
    const answered = view({
      messages: [...view().messages, { role: 'person', text: 'The register is hard to find' }, { role: 'interviewer', text: 'Thank you. That is everything.' }],
      answers: [{ key: 'free', question: 'What would you like to tell us about Unite?', answer: 'The register is hard to find' }],
      done: true,
    });
    let current = answered;
    const calls = mockApi({
      'POST /api/feedback': () => ({ token: TOKEN, question: 'q', feedback: view() }),
      [`POST /api/feedback/${TOKEN}/turns`]: () => ({ reply: 'Thank you. That is everything.', done: true, feedback: answered }),
      [`PATCH /api/feedback/${TOKEN}`]: (body) => {
        const b = body as { answers: { index: number; answer: string }[] };
        current = { ...current, answers: current.answers.map((a, i) => (i === b.answers[0]!.index ? { ...a, answer: b.answers[0]!.answer } : a)) };
        return { feedback: current };
      },
      [`POST /api/feedback/${TOKEN}/submit`]: () => ({ feedback: { ...current, status: 'received', statusLabel: 'Received' } }),
    });
    renderAt('/feedback');
    fireEvent.click(screen.getByRole('button', { name: 'Just tell us something' }));
    const box = await screen.findByLabelText('Your answer');
    expect(screen.getByText('Nothing yet. Your answers will appear here as you go.')).toBeTruthy();
    fireEvent.change(box, { target: { value: 'The register is hard to find' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    const panel = screen.getByRole('complementary', { name: 'Your answers' });
    expect(await within(panel).findByText('The register is hard to find')).toBeTruthy();
    expect(calls.find((c) => c.url.endsWith('/turns'))!.body).toEqual({ text: 'The register is hard to find' });

    fireEvent.click(within(panel).getByRole('button', { name: /Change your answer to/ }));
    const editor = within(panel).getByLabelText(/Your answer to:/);
    fireEvent.change(editor, { target: { value: 'The register link is hidden in the footer' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(await within(panel).findByText('The register link is hidden in the footer')).toBeTruthy();
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ answers: [{ index: 0, answer: 'The register link is hidden in the footer' }] });

    fireEvent.click(within(panel).getByRole('button', { name: 'Submit what I have said so far' }));
    expect(await within(panel).findByText(/We have received your feedback/)).toBeTruthy();
    expect(screen.queryByLabelText('Your answer')).toBeNull();
  });

  it('can submit before anything has been said', async () => {
    const calls = mockApi({
      'POST /api/feedback': () => ({ token: TOKEN, question: 'q', feedback: view({ mode: 'guided' }) }),
      [`POST /api/feedback/${TOKEN}/submit`]: () => ({ feedback: view({ mode: 'guided', status: 'received', statusLabel: 'Received' }) }),
    });
    renderAt('/feedback');
    fireEvent.click(screen.getByRole('button', { name: 'Answer a few questions, about eight minutes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Submit what I have said so far' }));
    expect(await screen.findByText(/We have received your feedback/)).toBeTruthy();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(['POST /api/feedback', `POST /api/feedback/${TOKEN}/submit`]);
  });

  it('shows the public summary exactly as it would be published before asking', async () => {
    const answered = view({ answers: [{ key: 'free', question: 'What would you like to tell us about Unite?', answer: 'Slow' }] });
    const previewText = 'What would you like to tell us about Unite?\nSlow';
    const calls = mockApi({
      'POST /api/feedback': () => ({ token: TOKEN, question: 'q', feedback: answered }),
      [`PATCH /api/feedback/${TOKEN}`]: (body) => {
        const state = (body as { publicIssue: { state: string } }).publicIssue.state;
        return { feedback: { ...answered, publicIssue: state === 'none' ? { state } : { state, text: previewText } } };
      },
    });
    renderAt('/feedback');
    fireEvent.click(screen.getByRole('button', { name: 'Just tell us something' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Show me the summary' }));
    const shown = await screen.findByTestId('public-summary');
    expect(shown.textContent).toBe(previewText);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, publish this summary' }));
    expect(await screen.findByRole('button', { name: 'Withdraw the public summary' })).toBeTruthy();
    expect(calls.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([
      { publicIssue: { state: 'previewed' } },
      { publicIssue: { state: 'agreed', text: previewText } },
    ]);
  });
});

describe('your feedback page', () => {
  it('shows the status in words with the reason, each answer, and lets the summary be withdrawn', async () => {
    const fb = view({
      status: 'planned',
      statusLabel: 'Planned',
      statusText: 'We plan to act on it.',
      statusReason: 'The register link moves to the top of every page.',
      submittedAt: '2026-11-13T10:00:00.000Z',
      answers: [{ key: 'free', question: 'What would you like to tell us about Unite?', answer: 'The register is hard to find' }],
      publicIssue: { state: 'agreed', text: 'What would you like to tell us about Unite?\nThe register is hard to find' },
    });
    const calls = mockApi({
      [`GET /api/feedback/${TOKEN}`]: () => ({ feedback: fb }),
      [`PATCH /api/feedback/${TOKEN}`]: () => ({ feedback: { ...fb, publicIssue: { state: 'withdrawn' } } }),
    });
    renderAt(`/feedback/${TOKEN}`);
    expect(await screen.findByText('Planned')).toBeTruthy();
    expect(screen.getByText('We plan to act on it.')).toBeTruthy();
    expect(screen.getByText('The register link moves to the top of every page.')).toBeTruthy();
    expect(screen.getByText('The register is hard to find')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw the public summary' }));
    expect(await screen.findByText(/You withdrew the public summary/)).toBeTruthy();
    expect(calls.at(-1)!.body).toEqual({ publicIssue: { state: 'withdrawn' } });
  });

  it('says plainly when the link is wrong', async () => {
    mockApi({});
    renderAt('/feedback/not-a-real-token-at-all');
    expect(await screen.findByRole('heading', { level: 1, name: 'We could not find this feedback' })).toBeTruthy();
  });
});

describe('what has changed page', () => {
  it('lists releases newest first with who each change affects, and links to feedback on them', async () => {
    mockApi({
      'GET /api/releases': () => ({
        releases: [
          { version: '0.2.0', date: '2026-12-01', changes: [{ text: 'Rooms can be spoken', affects: ['participants', 'hosts'] }] },
          { version: '0.1.0', date: '2026-11-13', changes: [{ text: 'The first build', affects: ['participants', 'hosts', 'stewards'] }] },
        ],
      }),
    });
    renderAt('/changes');
    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['Version 0.2.0', 'Version 0.1.0']);
    expect(screen.getByText('1 December 2026')).toBeTruthy();
    expect(screen.getByText('Affects participants, hosts and stewards.')).toBeTruthy();
    const links = screen.getAllByRole('link', { name: 'Tell us what you think of these changes' });
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/feedback?mode=changes&since=0.1.0', '/feedback?mode=changes']);
  });
});

describe('the steward feedback view', () => {
  const list: StewardFeedbackList = {
    items: [
      {
        id: 'fb_AAAAAAAAAAAA',
        path: '/register',
        mode: 'guided',
        modeLabel: 'Answered a few questions',
        status: 'received',
        statusLabel: 'Received',
        answers: [{ key: 'trying', question: 'What were you trying to do in Unite today?', answer: 'Find the register' }],
        createdAt: '2026-11-13T09:00:00.000Z',
        submittedAt: '2026-11-13T09:10:00.000Z',
      },
    ],
    counts: { total: 1, byStatus: { draft: 2, received: 1, planned: 0, done: 0, declined: 0 }, byMode: { guided: 1, free: 0, changes: 0 } },
    themes: [{ key: 'trying', question: 'What were you trying to do in Unite today?', answers: [{ feedbackId: 'fb_AAAAAAAAAAAA', question: 'What were you trying to do in Unite today?', answer: 'Find the register' }] }],
  };

  it('shows counts and themes with sources, needs a reason for a status, and offers export', async () => {
    const calls = mockApi({ 'GET /api/steward/feedback': () => list, 'PATCH /api/steward/feedback/fb_AAAAAAAAAAAA': () => ({ item: list.items[0] }) });
    render(
      <MemoryRouter>
        <FeedbackAdmin />
      </MemoryRouter>,
    );
    expect(await screen.findByText('1 piece of feedback has been sent.', { exact: false })).toBeTruthy();
    const source = screen.getByRole('link', { name: 'Find the register' });
    expect(source.getAttribute('href')).toBe('#feedback-fb_AAAAAAAAAAAA');
    expect(document.getElementById('feedback-fb_AAAAAAAAAAAA')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Download as CSV' }).getAttribute('href')).toBe('/api/steward/feedback/export?format=csv');
    expect(screen.getByRole('link', { name: 'Download as JSON' }).getAttribute('href')).toBe('/api/steward/feedback/export?format=json');

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'planned' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save the status' }).closest('form')!);
    expect(await screen.findByText(/Give a reason/)).toBeTruthy();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: 'Moving the link up' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save the status' }).closest('form')!);
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'planned', reason: 'Moving the link up' }));
  });
});
