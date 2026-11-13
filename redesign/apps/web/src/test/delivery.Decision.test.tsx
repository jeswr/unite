import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@unite/shared';
import { MeProvider } from '../lib/me';
import Decision from '../pages/delivery/Decision';
import Decisions from '../pages/delivery/Decisions';
import type { DecisionRecord, DecisionsResponse } from '@unite/shared';
import { answerLine, dueLine } from '../pages/delivery/words';

const D = 'dec_AAAAAAAAAAAA';
const assembly = { slug: 'tool', title: 'Volunteering tool', question: 'What should the tool do?', hostName: 'Northern Network', hostSlug: 'northern', isExample: true, stage: 'delivering' as const };

const record = (over: Partial<DecisionRecord> = {}, role: Role = 'participant'): DecisionRecord => ({
  decision: {
    id: D,
    assemblyId: 'asm_AAAAAAAAAAAA',
    statementId: 'st_AAAAAAAAAAAA',
    number: 1,
    title: 'A volunteer proves who they are once.',
    why: 'Repeating checks puts people off.',
    options: ['One shared check', 'A check per group'],
    dissent: 'Some groups want their own check.',
    tests: [
      { n: 1, text: 'A second group needs no new check.' },
      { n: 2, text: 'The volunteer sees who looked at their record.' },
    ],
    delivery: ['technology'],
    rank: 1,
    dueDate: '2026-11-01',
    reviewDate: '2027-11-01',
    status: 'delivered_minor_changes',
    answer: { kind: 'accepted', reasons: 'We have the budget and it is inside our remit.', answeredAt: '2026-10-30T10:00:00.000Z', answeredBy: 'Northern Network' },
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
  daysLate: 0,
  assembly: { ...assembly, checkBody: 'The check panel' },
  statement: { id: 'st_AAAAAAAAAAAA', text: 'A volunteer proves who they are once and can share that proof.' },
  trail: { themes: [{ id: 'thm_AAAAAAAAAAAA', name: 'Proving who I am again and again' }], people: 23 },
  proposals: [
    { id: 'prop_BBBBBBBBBBBB', decisionId: D, assemblyId: 'asm_AAAAAAAAAAAA', proposerName: 'Priya', proposerRole: 'Developer', summary: 'A record the volunteer holds.', plan: 'Build it.', testCoverage: [{ n: 1, how: 'Shared record.' }, { n: 2, how: 'Access log.' }], status: 'chosen', faithfulConfirmedAt: '2026-10-05T10:00:00.000Z' },
    { id: 'prop_CCCCCCCCCCCC', decisionId: D, assemblyId: 'asm_AAAAAAAAAAAA', proposerName: 'Tom', proposerRole: 'Volunteer', summary: 'A paper card.', plan: 'Print it.', testCoverage: [{ n: 1, how: 'Card.' }, { n: 2, how: 'Stamp.' }], status: 'not_chosen' },
  ],
  deliveryItems: [{ id: 'dlv_AAAAAAAAAAAA', decisionId: D, assemblyId: 'asm_AAAAAAAAAAAA', title: 'Shared check record', kind: 'technology', owner: 'Dana Okafor', dueDate: '2027-01-15', status: 'done', updates: [{ at: '2026-10-20T10:00:00.000Z', text: 'First version is live.' }] }],
  check: {
    id: 'chk_AAAAAAAAAAAA',
    decisionId: D,
    assemblyId: 'asm_AAAAAAAAAAAA',
    checkBody: 'The check panel',
    panel: ['Ade', 'Bea'],
    results: [
      { n: 1, met: true, note: 'Seen.' },
      { n: 2, met: false, note: 'Not yet for staff.' },
    ],
    classification: 'minor_changes',
    summary: 'Test 2 is met for groups but not yet for individual staff.',
    checkedAt: '2026-11-10T10:00:00.000Z',
  },
  viewer: { role, heard: false, isChecker: false },
  ...over,
});

function mockApi(routes: Record<string, unknown>) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith('/version')) return new Response(JSON.stringify({ version: 1 }), { status: 200 });
    const key = `${init?.method ?? 'GET'} ${u}`;
    const body = routes[key] ?? routes[u];
    return body === undefined ? new Response('{"error":{"code":"not_found","message":"Not here."}}', { status: 404 }) : new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const renderAt = (path: string, element: React.ReactElement, pattern: string, role: Role = 'participant') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <MeProvider initial={{ person: null, memberships: [], role, demo: false }}>
        <Routes>
          <Route path={pattern} element={element} />
        </Routes>
      </MeProvider>
    </MemoryRouter>,
  );

afterEach(() => vi.unstubAllGlobals());

describe('the decision record', () => {
  it('reads as a document: what, why, options, dissent, tests, the trail, the answer, plans, delivery and the check', async () => {
    mockApi({ [`/api/decisions/${D}`]: record() });
    renderAt(`/a/tool/decisions/${D}`, <Decision />, '/a/:slug/decisions/:id');
    expect(await screen.findByRole('heading', { level: 1, name: 'A volunteer proves who they are once.' })).toBeTruthy();
    expect(screen.getAllByText('Delivered with small changes').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Why',
      'The options that were considered',
      'The disagreement that remains',
      'Tests for “done”',
      'Where this came from',
      'The answer from Northern Network',
      'How it will be built',
      'Delivery',
      'The check',
    ]);
    expect(screen.getByText('From what 23 people said.')).toBeTruthy();
    expect(screen.getByText(/“Proving who I am again and again”/)).toBeTruthy();
    expect(screen.getByText('Accepted')).toBeTruthy();
    // The chosen plan first, with how it meets each test.
    const plans = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(plans.indexOf('A record the volunteer holds.')).toBeLessThan(plans.indexOf('A paper card.'));
    expect(screen.getByText('Shared record.')).toBeTruthy();
    expect(screen.getByText('First version is live.')).toBeTruthy();
    expect(screen.getByText('Test 1: met.')).toBeTruthy();
    expect(screen.getByText('Test 2: not met.')).toBeTruthy();
    expect(screen.getByText(/not yet for individual staff/)).toBeTruthy();
    expect(screen.getByText(/invented so you can see how Unite works/)).toBeTruthy();
    // No controls for a participant.
    expect(screen.queryByText(/Answer this decision/)).toBeNull();
    expect(screen.queryByText(/Record the check/)).toBeNull();
  });

  it('shows a missing answer as late, and the answer form to the host only', async () => {
    const waiting = record({ daysLate: 12, proposals: [], deliveryItems: [], check: null });
    waiting.decision = { ...waiting.decision, status: 'awaiting_answer', answer: undefined };
    mockApi({ [`/api/decisions/${D}`]: waiting });
    const { unmount } = renderAt(`/a/tool/decisions/${D}`, <Decision />, '/a/:slug/decisions/:id');
    expect(await screen.findByText('The answer is 12 days late.')).toBeTruthy();
    expect(screen.getAllByText('12 days late')[0]!.className).toMatch(/text-warn/);
    expect(screen.queryByText('Answer this decision')).toBeNull();
    unmount();

    const fetch = mockApi({ [`/api/decisions/${D}`]: { ...waiting, viewer: { role: 'host', heard: true, isChecker: false } }, [`POST /api/decisions/${D}/answer`]: { decision: waiting.decision } });
    renderAt(`/a/tool/decisions/${D}`, <Decision />, '/a/:slug/decisions/:id', 'host');
    await screen.findByText('Answer this decision');
    fireEvent.click(screen.getByRole('button', { name: 'Send the answer' }));
    expect(await screen.findByText('Choose one of the four answers.')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Refused/));
    fireEvent.change(screen.getByLabelText('Your reasons'), { target: { value: 'Too short.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send the answer' }));
    expect(await screen.findByText(/at least 40 characters/)).toBeTruthy();
    expect(fetch.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toBe(false);
    fireEvent.change(screen.getByLabelText('Your reasons'), { target: { value: 'There is no budget line for this and it is outside the remit we pledged.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send the answer' }));
    await waitFor(() => expect(fetch.mock.calls.some(([u, init]) => String(u).endsWith('/answer') && (init as RequestInit).method === 'POST')).toBe(true));
    const call = fetch.mock.calls.find(([u]) => String(u).endsWith('/answer'))!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({ kind: 'refused', reasons: 'There is no budget line for this and it is outside the remit we pledged.' });
  });

  it('offers the check form to a checker when work is in progress, and refuses a contradicting classification', async () => {
    const inProgress = record({ check: null, viewer: { role: 'participant', heard: true, isChecker: true } });
    inProgress.decision = { ...inProgress.decision, status: 'in_progress' };
    mockApi({ [`/api/decisions/${D}`]: inProgress });
    renderAt(`/a/tool/decisions/${D}`, <Decision />, '/a/:slug/decisions/:id');
    fireEvent.click((await screen.findByText('(check panel)')).closest('summary')!);
    const form = screen.getByRole('button', { name: 'Record the check' }).closest('form')!;
    const radios = within(form).getAllByRole('radio');
    fireEvent.click(radios[0]!); // test 1 met
    fireEvent.click(radios[3]!); // test 2 not met
    fireEvent.change(within(form).getByLabelText('What the panel found'), { target: { value: 'as_decided' } });
    expect(within(form).getByText('“Delivered as decided” needs every test to be met.')).toBeTruthy();
  });
});

describe('the decisions list', () => {
  it('shows cards in number order with status, lateness and the answer in one line', async () => {
    const body: DecisionsResponse = {
      assembly,
      decisions: [
        { id: 'dec_1AAAAAAAAAAA', number: 1, title: 'Prove who you are once', status: 'awaiting_answer', dueDate: '2026-11-01', daysLate: 12, answer: null },
        { id: 'dec_2AAAAAAAAAAA', number: 2, title: 'Travel costs', status: 'refused', dueDate: '2026-11-01', daysLate: 0, answer: { kind: 'refused', reasons: 'There is no budget line. We will publish travel policies instead.', answeredAt: '2026-10-30T10:00:00.000Z', answeredBy: 'N' } },
      ],
    };
    mockApi({ '/api/assemblies/tool/decisions': body });
    renderAt('/a/tool/decisions', <Decisions />, '/a/:slug/decisions');
    expect(await screen.findByText('Decision 1')).toBeTruthy();
    expect(screen.getByText('12 days late')).toBeTruthy();
    expect(screen.getByText('Refused. There is no budget line.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Travel costs' }).getAttribute('href')).toBe('/a/tool/decisions/dec_2AAAAAAAAAAA');
  });

  it('words the answer and the due date', () => {
    expect(answerLine(null)).toBe('The host has not answered yet.');
    expect(answerLine({ kind: 'delayed', reasons: 'Translators are booked. More later.', delayedUntil: '2027-03-01', answeredAt: '', answeredBy: '' })).toBe('Delayed until 1 March 2027. Translators are booked.');
    expect(dueLine({ status: 'awaiting_answer', dueDate: '2026-12-18', daysLate: 0 })).toEqual({ text: 'Answer due by 18 December 2026', late: false });
    expect(dueLine({ status: 'awaiting_answer', dueDate: '2026-11-12', daysLate: 1 })).toEqual({ text: '1 day late', late: true });
    expect(dueLine({ status: 'accepted', dueDate: '2026-11-12', daysLate: 0 })).toBeNull();
  });
});
