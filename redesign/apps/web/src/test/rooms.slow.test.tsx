import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoomsResponse } from '@unite/shared';
import Rooms from '../pages/rooms/Rooms';
import { DEFAULT_ROOM_LENGTH, roomLengthBody, RoomLengthFields, type RoomLength } from '../pages/rooms/RoomLength';
import { roomTimeLeft, slowRoomLine, writeFirstNotice } from '../pages/rooms/time';

const NOW = '2026-11-13T09:00:00.000Z';
const HOUR = 3_600_000;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('slow-room words', () => {
  it('counts the people who have written, in plain words', () => {
    expect(writeFirstNotice(3)).toBe('3 people have written. You will see what they wrote once you have written where you stand.');
    expect(writeFirstNotice(1)).toBe('1 person has written. You will see what they wrote once you have written where you stand.');
    expect(writeFirstNotice(0)).toMatch(/^Nobody else has written yet\./);
  });

  it('gives the time left in days for a slow room and in minutes for a live one', () => {
    expect(roomTimeLeft(3 * 24 * HOUR, 'slow')).toBe('3 days left');
    expect(roomTimeLeft(5 * HOUR, 'slow')).toBe('5 hours left');
    expect(roomTimeLeft(2 * HOUR, 'live')).toBe('120 minutes left');
    expect(roomTimeLeft(30_000, 'live')).toBe('Less than a minute left');
    expect(slowRoomLine('2026-11-16T09:00:00.000Z')).toBe('This is a slow room. It is open until 16 November 2026. Write when you can, and come back to read the others.');
  });
});

describe('choosing how a room runs', () => {
  function Form({ onBody }: { onBody: (b: object) => void }) {
    const [v, setV] = useState<RoomLength>(DEFAULT_ROOM_LENGTH);
    return (
      <>
        <RoomLengthFields value={v} onChange={setV} />
        <button type="button" onClick={() => onBody(roomLengthBody(v))}>
          Draw
        </button>
      </>
    );
  }

  it('offers "Live, for N minutes" or "Slow, for N days", live by default', () => {
    const bodies: object[] = [];
    render(<Form onBody={(b) => bodies.push(b)} />);
    const live = screen.getByRole('radio', { name: /Live, for 45 minutes/ }) as HTMLInputElement;
    expect(live.checked).toBe(true);
    expect(screen.getByLabelText('How long, in minutes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Draw' }));
    expect(bodies.at(-1)).toEqual({ minutes: 45 });

    fireEvent.click(screen.getByRole('radio', { name: /Slow, for 5 days/ }));
    const days = screen.getByLabelText('How long, in days') as HTMLInputElement;
    expect(days.min).toBe('2');
    expect(days.max).toBe('14');
    expect(screen.queryByLabelText('How long, in minutes')).toBeNull();
    fireEvent.change(days, { target: { value: '7' } });
    expect(screen.getByRole('radio', { name: /Slow, for 7 days/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Draw' }));
    expect(bodies.at(-1)).toEqual({ pace: 'slow', days: 7 });
  });
});

describe('the rooms list', () => {
  const list: RoomsResponse = {
    myRoom: {
      id: 'room_AAAAAAAAAAAA',
      topic: 'Should courses be chosen by what employers say they need?',
      status: 'open',
      pace: 'slow',
      minutes: 5 * 1440,
      startedAt: '2026-11-11T09:00:00.000Z',
      endsAt: '2026-11-16T09:00:00.000Z',
      members: [
        { name: 'Priya', isMe: true },
        { name: 'Jas', isMe: false },
      ],
    },
    others: [{ id: 'room_BBBBBBBBBBBB', topic: 'AI tools as a basic skill', status: 'scheduled', pace: 'live', minutes: 45, startedAt: null, endsAt: null, size: 6 }],
    closed: [
      {
        id: 'room_CCCCCCCCCCCC',
        topic: 'Losing pay to retrain',
        pace: 'live',
        wasMine: false,
        outcome: { reasonsFor: [], reasonsAgainst: [], questionsForExperts: [] },
        answers: { agree: 1, disagree: 1, unsure: 0, total: 2 },
      },
    ],
    canManage: false,
    now: NOW,
  };

  it('labels each room live or slow, with a slow room’s time left in days', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.endsWith('/rooms')) return new Response(JSON.stringify(list));
        if (u.endsWith('/evidence')) return new Response(JSON.stringify({ evidence: [] }));
        if (u.endsWith('/version')) return new Response(JSON.stringify({ version: 1 }));
        return new Response(JSON.stringify({ error: { code: 'not_found', message: 'no' } }), { status: 404 });
      }),
    );
    render(
      <MemoryRouter initialEntries={['/a/earning-and-learning/rooms']}>
        <Routes>
          <Route path="/a/:slug/rooms" element={<Rooms />} />
        </Routes>
      </MemoryRouter>,
    );
    const mine = (await screen.findByText(/Open now\. 3 days left\./)).closest('p')!;
    expect(mine.textContent).toBe('Slow room Open now. 3 days left.');
    expect(screen.getByText(/6 people\. Not open yet\. It will run for 45 minutes once it opens\./).closest('p')!.textContent).toMatch(/^Live room /);
    expect(screen.getAllByText('Live room')).toHaveLength(2);
    expect(screen.getAllByText('Slow room')).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/room_[A-Z]/);
  });
});
