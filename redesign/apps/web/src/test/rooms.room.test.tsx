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
    pace: 'live',
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
  mustWriteFirst: false,
  hiddenCount: 0,
  hiddenPeople: 0,
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
  mustWriteFirst: false,
  hiddenCount: 0,
  hiddenPeople: 0,
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

  describe('a slow room', () => {
    const SLOW_NOW = new Date('2026-11-13T09:00:00.000Z');
    const slowRoom = (over: Partial<RoomResponse> = {}) =>
      roomBody(
        { now: SLOW_NOW.toISOString(), mustWriteFirst: true, hiddenCount: 4, hiddenPeople: 3, ...over },
        { pace: 'slow', minutes: 5 * 1440, startedAt: '2026-11-11T09:00:00.000Z', endsAt: '2026-11-16T09:00:00.000Z' },
      );
    const welcome = { id: 'msg_AAAAAAAAAAA1', authorType: 'facilitator' as const, author: 'Facilitator (AI)', mine: false, text: 'Welcome. This room is open for 5 days.', createdAt: SLOW_NOW.toISOString() };
    const bo = { id: 'msg_AAAAAAAAAAA2', authorType: 'person' as const, author: 'Bo', mine: false, text: 'I run a garage and cannot find anyone trained.', createdAt: SLOW_NOW.toISOString() };

    /** Serves the messages held back until the member has posted, as the server does. */
    function mockSlow(room: RoomResponse, held = { hiddenCount: 4, hiddenPeople: 3 }) {
      let written = false;
      const urls: string[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init?: RequestInit) => {
          const u = String(url);
          if (init?.method === 'POST') {
            written = true;
            return new Response(JSON.stringify({ message: {} }), { status: 201 });
          }
          if (u.endsWith('/version')) return new Response(JSON.stringify({ version: 1 }));
          if (u.includes('/messages')) {
            urls.push(u);
            const mine = { id: 'msg_AAAAAAAAAAA3', authorType: 'person' as const, author: 'Amina', mine: true, text: 'Evening courses or nothing.', createdAt: SLOW_NOW.toISOString() };
            const body: MessagesResponse = written
              ? { messages: [welcome, bo, mine], status: 'open', endsAt: room.room.endsAt, mustWriteFirst: false, hiddenCount: 0, hiddenPeople: 0, now: room.now }
              : { messages: [welcome], status: 'open', endsAt: room.room.endsAt, mustWriteFirst: true, ...held, now: room.now };
            return new Response(JSON.stringify(body));
          }
          if (u.includes('/api/rooms/')) return new Response(JSON.stringify(written ? { ...room, mustWriteFirst: false, hiddenCount: 0, hiddenPeople: 0 } : room));
          return new Response(JSON.stringify({ error: { code: 'not_found', message: 'no' } }), { status: 404 });
        }),
      );
      return urls;
    }

    it('says it is a slow room, until when, and the time left in days', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: SLOW_NOW });
      mockSlow(slowRoom());
      renderRoom();
      expect(await screen.findByText('This is a slow room. It is open until 16 November 2026. Write when you can, and come back to read the others.')).toBeTruthy();
      expect(screen.getByText('3 days left')).toBeTruthy();
    });

    it('shows the write-first notice with how many people have written, then the others once you have written', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: SLOW_NOW });
      const urls = mockSlow(slowRoom());
      renderRoom();
      expect(await screen.findByText('3 people have written. You will see what they wrote once you have written where you stand.')).toBeTruthy();
      expect(await screen.findByText('Welcome. This room is open for 5 days.')).toBeTruthy();
      expect(screen.queryByText(bo.text)).toBeNull();
      fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Evening courses or nothing.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      expect(await screen.findByText(bo.text)).toBeTruthy();
      expect(screen.getByText('Evening courses or nothing.')).toBeTruthy();
      expect(screen.queryByText(/people have written/)).toBeNull();
      // The whole list is fetched again after writing, so the held-back messages arrive in their places.
      expect(urls.every((u) => !u.includes('after='))).toBe(true);
      const items = screen.getAllByRole('listitem').map((li) => li.textContent);
      expect(items.findIndex((t) => t?.includes(bo.text))).toBeLessThan(items.findIndex((t) => t?.includes('Evening courses or nothing.')));
    });

    it('says plainly when nobody else has written yet', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: SLOW_NOW });
      mockSlow(slowRoom({ hiddenCount: 0, hiddenPeople: 0 }), { hiddenCount: 0, hiddenPeople: 0 });
      renderRoom();
      expect(await screen.findByText('Nobody else has written yet. Write where you stand, and you will see what the others write after that.')).toBeTruthy();
    });

    it('says how long a scheduled slow room will be open', async () => {
      mockSlow(roomBody({ mustWriteFirst: false }, { status: 'scheduled', pace: 'slow', minutes: 3 * 1440, startedAt: null, endsAt: null }));
      renderRoom();
      expect(await screen.findByText('This is a slow room. It will be open for 3 days once it opens.')).toBeTruthy();
    });

    it('keeps what others added from a member who never wrote, once time is up', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-16T10:00:00.000Z') });
      mockSlow(slowRoom({ now: '2026-11-16T10:00:00.000Z' }));
      renderRoom();
      expect(await screen.findByRole('heading', { name: 'Your private final answer' })).toBeTruthy();
      expect(screen.queryByLabelText('What are you adding?')).toBeNull();
      expect(screen.getByText(/you did not write in it/)).toBeTruthy();
    });
  });
});
