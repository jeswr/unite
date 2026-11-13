import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCRIPTED_MODE_LABEL } from '@unite/shared';
import { MeProvider } from '../lib/me';
import Conversation from '../pages/talk/Conversation';
import { CID, mockApi, turn, view } from './talk.fixtures';

function show() {
  return render(
    <MemoryRouter initialEntries={[`/talk/${CID}`]}>
      <MeProvider initial={{ person: null, memberships: [], role: 'participant', demo: false }}>
        <Routes>
          <Route path="/talk/:id" element={<Conversation />} />
          <Route path="/talk/:id/review" element={<p>Review page</p>} />
        </Routes>
      </MeProvider>
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('the conversation page', () => {
  it('shows the turns, the stage in words, and the message box with skip and stop', async () => {
    mockApi(() => view());
    show();
    expect(await screen.findByText('I worked the night shift.')).toBeTruthy();
    expect(screen.getByText('Tell me about yesterday?')).toBeTruthy();
    const box = screen.getByLabelText('Your answer');
    expect(box.tagName).toBe('TEXTAREA');
    expect(box.closest('.fixed')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip this' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stop here and review' })).toBeTruthy();
    // Stage names as words, the current one marked, and the phone line.
    expect(screen.getByText('Step 3 of 8:')).toBeTruthy();
    const current = document.querySelector('[aria-current="step"]');
    expect(current?.textContent).toContain('What got in the way');
    expect(screen.queryByText(SCRIPTED_MODE_LABEL)).toBeNull();
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy();
    // No microphone where the browser has no speech recognition.
    expect(screen.queryByRole('button', { name: /speak/i })).toBeNull();
  });

  it('shows the fixed-questions label in scripted mode', async () => {
    mockApi(() => view({ mode: 'scripted' }));
    show();
    expect(await screen.findByText(SCRIPTED_MODE_LABEL)).toBeTruthy();
  });

  it('sends on Enter, keeps Shift+Enter for a new line, and announces the new question', async () => {
    const next = view({}, { turns: [...view().turns, turn('c', 'person', 'I slept.'), turn('d', 'interviewer', 'What happened after that?')] });
    const calls = mockApi((c) => (c.method === 'POST' ? next : view()));
    show();
    const box = (await screen.findByLabelText('Your answer')) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'I slept.' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ text: 'I slept.' }));
    expect(calls.find((c) => c.method === 'POST')?.url).toBe(`/api/conversations/${CID}/turns`);
    await waitFor(() => expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('What happened after that?'));
    expect(box.value).toBe('');
  });

  it('"Skip this" sends a skip', async () => {
    const calls = mockApi((c) => (c.method === 'POST' ? view({ stage: 4 }) : view()));
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Skip this' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ skip: true }));
    expect(await screen.findByText('Step 4 of 8:')).toBeTruthy();
  });

  it('after distress, offers to carry on or stop instead of the box', async () => {
    mockApi(() => view({}, { pending: 'distress' }));
    show();
    expect(await screen.findByRole('button', { name: 'Carry on' })).toBeTruthy();
    expect(screen.queryByLabelText('Your answer')).toBeNull();
  });

  it('goes to the review once the conversation moves there', async () => {
    mockApi(() => view({ status: 'reviewing', stage: 9 }));
    show();
    expect(await screen.findByText('Review page')).toBeTruthy();
  });

  it('shows the written questions as a form on that route', async () => {
    const calls = mockApi((c) =>
      c.method === 'POST' ? view({ route: 'questions', stage: 2 }, { questions: ['Q3?', 'Q4?'], turns: [] }) : view({ route: 'questions', stage: 1 }, { questions: ['Q1?', 'Q2?'], turns: [] }),
    );
    show();
    fireEvent.change(await screen.findByLabelText('Q1?'), { target: { value: 'My answer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ answers: ['My answer'] }));
    expect(await screen.findByLabelText('Q3?')).toBeTruthy();
  });
});
