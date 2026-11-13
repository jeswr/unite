import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Room from '../pages/rooms/Room';
import type { MessagesResponse, RoomResponse } from '@unite/shared';

const NOW = new Date('2026-11-13T09:14:00.000Z');

const roomBody = (over: Partial<RoomResponse> = {}, roomOver: Partial<RoomResponse['room']> = {}): RoomResponse => ({
  room: {
    id: 'room_AAAAAAAAAAAA',
    topic: 'Teaching AI tools as a basic skill',
    status: 'open',
    minutes: 45,
    startedAt: '2026-11-13T09:00:00.000Z',
    endsAt: '2026-11-13T09:45:00.000Z',
    statement: { id: 'st_AAAAAAAAAAAA', text: 'Everyone should be taught to use AI tools as a basic skill, like reading.' },
    briefing: { summary: 'People see this differently.', forSide: ['It is becoming part of most jobs'], againstSide: ['Basic reading and maths come first'], evidence: [] },
    outcome: null,
    ...roomOver,
  },
  assembly: { slug: 'earning-and-learning' },
  members: [
    { name: 'Amina', isMe: true },
    { name: 'Bo', isMe: false },
  ],
  memberCount: 2,
  isMember: true,
  canManage: false,
  myAnswer: null,
  answerTotals: null,
  now: NOW.toISOString(),
  ...over,
});

const messages: MessagesResponse = {
  messages: [
    { id: 'msg_AAAAAAAAAAA1', authorType: 'facilitator', author: 'Facilitator (AI)', mine: false, text: 'Welcome. Who would like to start?', createdAt: NOW.toISOString() },
    { id: 'msg_AAAAAAAAAAA2', authorType: 'person', author: 'Bo', mine: false, text: 'I use it at work every day.', createdAt: NOW.toISOString() },
    { id: 'msg_AAAAAAAAAAA3', authorType: 'person', author: 'Amina', mine: true, text: 'I have never needed it.', createdAt: NOW.toISOString() },
  ],
  status: 'open',
  endsAt: '2026-11-13T09:45:00.000Z',
  now: NOW.toISOString(),
};

function mock(room: RoomResponse) {
  const posts: { url: string; body: unknown }[] = [];
  let served = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === 'POST') {
        posts.push({ url: u, body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify({ message: {} }), { status: 201 });
      }
      if (u.endsWith('/version')) return new Response(JSON.stringify({ version: 1 }));
      if (u.includes('/messages')) {
        const body = { ...(served ? { ...messages, messages: [] } : messages), now: room.now };
        served = true;
        return new Response(JSON.stringify(body));
      }
      if (u.includes('/api/rooms/')) return new Response(JSON.stringify(room));
      return new Response(JSON.stringify({ error: { code: 'not_found', message: 'no' } }), { status: 404 });
    }),
  );
  return posts;
}

const renderRoom = () =>
  render(
    <MemoryRouter initialEntries={['/a/earning-and-learning/rooms/room_AAAAAAAAAAAA']}>
      <Routes>
        <Route path="/a/:slug/rooms/:roomId" element={<Room />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('room page', () => {
  it('shows the briefing, the timer in words, labelled facilitator turns, and a live message list', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    mock(roomBody());
    renderRoom();
    expect(await screen.findByRole('heading', { level: 1, name: 'Teaching AI tools as a basic skill' })).toBeTruthy();
    expect(screen.getByText('31 minutes left')).toBeTruthy();
    expect(screen.getByText('The case for')).toBeTruthy();
    expect(screen.getByText('The case against')).toBeTruthy();
    expect(await screen.findByText('Welcome. Who would like to start?')).toBeTruthy();
    const fac = screen.getByText('Welcome. Who would like to start?').closest('li')!;
    expect(fac.textContent).toContain('Facilitator (AI)');
    expect(fac.getAttribute('data-author')).toBe('facilitator');
    expect(screen.getByText('I have never needed it.').closest('li')!.textContent).toContain('You');
    expect(fac.closest('ol')!.getAttribute('aria-live')).toBe('polite');
  });

  it('has a labelled message box with a character count that sends the message', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    const posts = mock(roomBody());
    renderRoom();
    const box = (await screen.findByLabelText('Your message')) as HTMLTextAreaElement;
    expect(box.maxLength).toBe(600);
    expect(screen.getByText('0 of 600 characters')).toBeTruthy();
    const send = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(box, { target: { value: 'Night classes help me.' } });
    expect(screen.getByText('22 of 600 characters')).toBeTruthy();
    fireEvent.click(send);
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ url: '/api/rooms/room_AAAAAAAAAAAA/messages', body: { text: 'Night classes help me.' } });
    await waitFor(() => expect(box.value).toBe(''));
  });

  it('shows the private final answer and outcome forms instead of the message box when time is up', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-13T09:46:00.000Z') });
    mock(roomBody({ now: '2026-11-13T09:46:00.000Z' }));
    renderRoom();
    expect(await screen.findByRole('heading', { name: 'Your private final answer' })).toBeTruthy();
    expect(screen.getByText('Time is up')).toBeTruthy();
    expect(screen.queryByLabelText('Your message')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Not sure' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save my private answer' })).toBeTruthy();
    expect(screen.getByLabelText('What are you adding?')).toBeTruthy();
  });

  it('explains plainly to someone who is not in the room, without messages', async () => {
    mock(roomBody({ isMember: false, members: [], memberCount: 6 }));
    renderRoom();
    expect(await screen.findByRole('heading', { name: 'You are not in this room' })).toBeTruthy();
    expect(screen.getByText(/6 people in this room were drawn by lot/)).toBeTruthy();
    expect(screen.queryByLabelText('Your message')).toBeNull();
  });

  it('shows a closed room’s outcome and the answer totals only', async () => {
    mock(
      roomBody(
        { answerTotals: { agree: 2, disagree: 3, unsure: 1, total: 6 } },
        { status: 'closed', outcome: { reasonsFor: ['Jobs need it'], reasonsAgainst: ['Reading first'], proposedWording: 'Offer AI basics to anyone who wants them.', questionsForExperts: [] } },
      ),
    );
    renderRoom();
    expect(await screen.findByRole('heading', { name: 'What the room found' })).toBeTruthy();
    expect(screen.getByText('Final answers: 2 agree, 3 disagree, 1 not sure.')).toBeTruthy();
    expect(screen.getByText('Offer AI basics to anyone who wants them.')).toBeTruthy();
  });
});
