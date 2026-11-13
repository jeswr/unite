import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCRIPTED_MODE_LABEL, type Mediation, type MediationView, type StatementDetail } from '@unite/shared';
import { MeProvider } from '../lib/me';
import TalkItThrough from '../pages/mediation/TalkItThrough';
import { TalkCard } from '../pages/statements/TalkCard';
import { mockApi } from './talk.fixtures';

const SID = 'st_AAAAAAAAAAAA';
const MID = 'med_AAAAAAAAAAAA';
const RAW_ID = /\b(med|rsn|st|per|asm)_[A-Za-z0-9_-]{6,}/;
const AT = '2026-11-13T09:00:00.000Z';

function detail(over: Partial<StatementDetail['statement']> = {}, mediation: StatementDetail['mediation'] = { completed: 0 }): StatementDetail {
  return {
    statement: { id: SID, text: 'Everyone should learn AI tools.', version: 1, origin: 'ai', mine: false, createdAt: AT, myReaction: 'agree', status: 'differ', ...over },
    assembly: { slug: 'riverbend', title: 'Earning and learning', isExample: false },
    earlier: [],
    later: [],
    sources: { people: 0, quotes: [], themes: [] },
    reasons: { for: [], against: [], questions: [] },
    objections: [],
    reports: [],
    canSteward: false,
    mediation,
  };
}

function view(over: Partial<Mediation> = {}, rest: Partial<MediationView> = {}): MediationView {
  return {
    mediation: {
      id: MID,
      assemblyId: 'asm_AAAAAAAAAAAA',
      statementId: SID,
      personId: 'per_AAAAAAAAAAAA',
      status: 'active',
      step: 1,
      answer: 'agree',
      turns: [{ role: 'mediator', step: 1, text: 'What happened, and how is it behind your answer?', createdAt: AT, fallback: true }],
      shownReasonIds: [],
      drafts: {},
      aiUsed: false,
      startedAt: AT,
      updatedAt: AT,
      ...over,
    },
    statement: { id: SID, text: 'Everyone should learn AI tools.', status: 'differ' },
    assembly: { slug: 'riverbend', title: 'Earning and learning', isExample: false },
    shownReasons: [],
    pending: null,
    ...rest,
  };
}

function show() {
  return render(
    <MemoryRouter initialEntries={[`/a/riverbend/statements/${SID}/talk`]}>
      <MeProvider initial={{ person: null, memberships: [], role: 'participant', demo: false }}>
        <Routes>
          <Route path="/a/:slug/statements/:id/talk" element={<TalkItThrough />} />
          <Route path="/a/:slug/statements/:id" element={<p>Statement page</p>} />
        </Routes>
      </MeProvider>
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('talk it through', () => {
  it('explains itself, starts on "Start", then asks one question at a time with the fixed-questions notice', async () => {
    const calls = mockApi((c) => (c.url.endsWith('/mediations') && c.method === 'POST' ? view() : detail()));
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'Talk it through' })).toBeTruthy();
    expect(screen.getByText(/takes about five minutes/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.url).toBe(`/api/statements/${SID}/mediations`));
    expect(await screen.findByText('What happened, and how is it behind your answer?')).toBeTruthy();
    expect(screen.getByText(SCRIPTED_MODE_LABEL)).toBeTruthy();
    expect(screen.getByText('Step 1 of 4:')).toBeTruthy();
    const box = screen.getByLabelText('Your answer');
    expect(box.closest('.fixed')).toBeTruthy();
    expect(box.getAttribute('maxlength')).toBe('1200');
    expect(screen.getByRole('button', { name: 'Skip this' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stop here and review' })).toBeTruthy();
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(RAW_ID);
  });

  it('asks a person to answer the statement first', async () => {
    mockApi(() => detail({ myReaction: null, status: undefined }));
    show();
    expect(await screen.findByText('Answer the statement first, then talk it through.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
  });

  it('opens my own, sends an answer, and shows the other side’s reasons as quotations without the AI notice when it is on', async () => {
    const step2 = view(
      {
        step: 2,
        aiUsed: true,
        turns: [
          ...view().mediation.turns,
          { role: 'person', step: 1, text: 'I lost a job to a machine.', createdAt: AT },
          { role: 'mediator', step: 2, text: 'What is true in those reasons?', createdAt: AT },
        ],
        shownReasonIds: ['rsn_AAAAAAAAAAAA'],
      },
      { shownReasons: [{ id: 'rsn_AAAAAAAAAAAA', side: 'against', text: 'The tools change every year.' }] },
    );
    const calls = mockApi((c) => (c.url.includes('/api/statements/') ? detail({}, { mine: { id: MID, status: 'active' }, completed: 0 }) : c.method === 'POST' ? step2 : view({ aiUsed: true })));
    show();
    const box = (await screen.findByLabelText('Your answer')) as HTMLTextAreaElement;
    expect(screen.queryByText(SCRIPTED_MODE_LABEL)).toBeNull();
    fireEvent.change(box, { target: { value: 'I lost a job to a machine.' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ text: 'I lost a job to a machine.' }));
    expect(await screen.findByRole('heading', { name: 'Reasons from people who answered differently' })).toBeTruthy();
    expect(screen.getByText('“The tools change every year.”')).toBeTruthy();
    await waitFor(() => expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('What is true in those reasons?'));
    expect(document.body.textContent).not.toMatch(RAW_ID);
  });

  it('reviews: asks a person who was not sure to choose a side, saves the drafts, approves and thanks them', async () => {
    const reviewing = view({ status: 'reviewing', answer: 'unsure', drafts: { reason: 'Night classes let me keep my shift.', question: 'Who pays?' } });
    const done = view({ status: 'complete', answer: 'unsure', drafts: { reason: 'Night classes let me keep my shift.', reasonSide: 'against' }, approved: { reasonId: 'rsn_AAAAAAAAAAAA' } });
    const calls = mockApi((c) => {
      if (c.url.includes('/api/statements/')) return detail({}, { mine: { id: MID, status: 'reviewing' }, completed: 0 });
      if (c.url.endsWith('/approve')) return done;
      return reviewing;
    });
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'Here is what I heard' })).toBeTruthy();
    expect((screen.getByLabelText('Your reason, in your words') as HTMLTextAreaElement).value).toBe('Night classes let me keep my shift.');
    expect(screen.getByText('I did not hear one. Write one if you like, or leave it empty.')).toBeTruthy();
    // Scrap the question.
    const scraps = screen.getAllByRole('button', { name: 'Scrap this' });
    fireEvent.click(scraps[scraps.length - 1]!);
    expect(await screen.findByText('Scrapped. This will not be added.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'These are right' }));
    expect(await screen.findByText('Choose whether your reason is for or against the statement.')).toBeTruthy();
    expect(calls.find((c) => c.url.endsWith('/approve'))).toBeUndefined();
    fireEvent.click(screen.getByRole('radio', { name: 'Against the statement' }));
    fireEvent.click(screen.getByRole('button', { name: 'These are right' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Thank you' })).toBeTruthy();
    const last = calls.filter((c) => c.method === 'PATCH').at(-1);
    expect(last?.body).toEqual({ reason: 'Night classes let me keep my shift.', wording: '', question: '', reasonSide: 'against' });
    expect(screen.getByText('A reason against')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the statement' }).getAttribute('href')).toBe(`/a/riverbend/statements/${SID}`);
  });

  it('says so when the conversation is someone else’s', async () => {
    mockApi((c) =>
      c.url.includes('/api/mediations/')
        ? new Response(JSON.stringify({ error: { code: 'not_yours', message: 'Only the person who is talking this through can see it or change it.' } }), { status: 403 })
        : detail({}, { mine: { id: MID, status: 'active' }, completed: 0 }),
    );
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'This conversation is not yours' })).toBeTruthy();
  });
});

describe('the card on the statement page', () => {
  const card = (d: StatementDetail) =>
    render(
      <MemoryRouter>
        <TalkCard slug="riverbend" detail={d} />
      </MemoryRouter>,
    );

  it('appears once I have answered, with what it is and how long it takes', () => {
    card(detail({}, { completed: 4 }));
    expect(screen.getByRole('heading', { name: 'Talk it through' })).toBeTruthy();
    expect(screen.getByText(/about five minutes/)).toBeTruthy();
    expect(screen.getByText('4 people have talked this statement through.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Talk it through' }).getAttribute('href')).toBe(`/a/riverbend/statements/${SID}/talk`);
  });

  it('is not there before I answer, or on a settled statement I never talked through', () => {
    card(detail({ myReaction: null }));
    card(detail({ status: 'decided' }));
    expect(screen.queryByRole('heading', { name: 'Talk it through' })).toBeNull();
  });

  it('takes me back to my own', () => {
    card(detail({}, { mine: { id: MID, status: 'complete' }, completed: 1 }));
    expect(screen.getByRole('link', { name: 'See what you added' })).toBeTruthy();
  });
});
