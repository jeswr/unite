import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeProvider } from '../lib/me';
import ApproveByLink from '../pages/talk/ApproveByLink';
import TalkStart from '../pages/talk/TalkStart';
import { CID, mockApi, point, view } from './talk.fixtures';

const consent = { lines: ['You will be talking with an AI interviewer.', 'You can skip any question.'], aiEnabled: false };
const meResponse = { person: null, memberships: [], role: 'participant', demo: false };

afterEach(() => vi.unstubAllGlobals());

describe('starting a conversation', () => {
  it('offers three ways in with the AI interviewer first, the language, the consent lines, and one primary button', async () => {
    const calls = mockApi((c) => (c.url === '/api/talk/consent' ? consent : c.url === '/api/me' ? meResponse : view({ stage: 0 })));
    render(
      <MemoryRouter initialEntries={['/talk']}>
        <MeProvider initial={meResponse as never}>
          <Routes>
            <Route path="/talk" element={<TalkStart />} />
            <Route path="/talk/:id" element={<p>Conversation page</p>} />
          </Routes>
        </MeProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('You will be talking with an AI interviewer.')).toBeTruthy();
    expect((screen.getByLabelText(/Talk with the AI interviewer/) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText(/Answer written questions/)).toBeTruthy();
    expect(screen.getByText(/the questions will be fixed ones/)).toBeTruthy();
    expect(screen.getByText('The interviewer replies in the language you write in.')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Write freely/));
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'cy' } });
    fireEvent.click(screen.getByRole('button', { name: 'I understand. Start' }));
    await waitFor(() => expect(screen.getByText('Conversation page')).toBeTruthy());
    expect(calls.find((c) => c.url === '/api/conversations')?.body).toEqual({ route: 'freetext', language: 'cy' });
    expect(calls.some((c) => c.url === `/api/conversations/${CID}/consent`)).toBe(true);
  });
});

describe('approving through a one-time link', () => {
  it('shows the host’s draft points and sends the person’s changes', async () => {
    const p = point('h', { text: 'Classes at seven' });
    const calls = mockApi((c) =>
      c.method === 'POST' ? view({ status: 'complete', stage: 9 }) : c.url === '/api/me' ? meResponse : { assembly: view().assembly, language: 'en-GB', points: [p] },
    );
    render(
      <MemoryRouter initialEntries={['/approve/tok']}>
        <MeProvider initial={meResponse as never}>
          <Routes>
            <Route path="/approve/:token" element={<ApproveByLink />} />
            <Route path="/talk/:id/review" element={<p>Exit questions</p>} />
          </Routes>
        </MeProvider>
      </MemoryRouter>,
    );
    const box = await screen.findByLabelText('Point 1, in your words');
    fireEvent.change(box, { target: { value: 'Classes are at seven, when I work' } });
    fireEvent.click(screen.getByLabelText(/Counted only/));
    fireEvent.click(screen.getByRole('button', { name: 'These are right' }));
    await waitFor(() => expect(screen.getByText('Exit questions')).toBeTruthy());
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({
      url: '/api/approve/tok',
      body: { points: [{ id: p.id, text: 'Classes are at seven, when I work', visibility: 'count', status: 'draft' }], added: [] },
    });
  });
});
