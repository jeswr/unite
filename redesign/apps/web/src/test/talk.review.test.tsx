import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Point } from '@unite/shared';
import { MeProvider } from '../lib/me';
import Review from '../pages/talk/Review';
import { CID, mockApi, point, turn, view, type Call } from './talk.fixtures';

const source = turn('s', 'person', 'I got off at six and took the 5am bus home.');
const p1 = point('one', { text: 'I took the 5am bus home', sourceTurnIds: [source.id] });
const p2 = point('two', { type: 'barrier', text: 'The course runs at seven' });
const reviewing = () => view({ status: 'reviewing', stage: 9 }, { turns: [source], points: [p1, p2] });

function show() {
  return render(
    <MemoryRouter initialEntries={[`/talk/${CID}/review`]}>
      <MeProvider initial={{ person: null, memberships: [], role: 'participant', demo: false }}>
        <Routes>
          <Route path="/talk/:id/review" element={<Review />} />
        </Routes>
      </MeProvider>
    </MemoryRouter>,
  );
}

/** A small fake server for the review: PATCH and POST change the points it holds. */
function server() {
  let points: Point[] = [p1, p2];
  let status: 'reviewing' | 'complete' = 'reviewing';
  const calls = mockApi((c: Call) => {
    const body = c.body as Record<string, unknown> | undefined;
    if (c.method === 'PATCH') {
      const id = c.url.split('/').pop();
      points = points.map((p) => (p.id === id ? { ...p, ...(body as Partial<Point>) } : p));
      return { point: points.find((p) => p.id === id) };
    }
    if (c.method === 'POST' && c.url.endsWith('/approve')) {
      status = 'complete';
      points = points.map((p) => (p.status === 'draft' ? { ...p, status: 'approved' } : p));
    }
    if (c.method === 'POST' && c.url.endsWith('/points')) {
      const added = point('three', { ...(body as Partial<Point>) });
      points = [...points, added];
      return { point: added };
    }
    if (c.method === 'POST' && c.url.endsWith('/exit')) return view({ status: 'complete', stage: 9, exit: body as never }, { turns: [source], points });
    if (c.url === '/api/me') return { person: null, memberships: [], role: 'participant', demo: false };
    return view({ status, stage: 9 }, { turns: [source], points });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('the review page', () => {
  it('shows each point with its words, type in words, source and how it is shown', async () => {
    mockApi(() => reviewing());
    show();
    expect(await screen.findByRole('heading', { name: 'Here is what I heard' })).toBeTruthy();
    const box = screen.getByLabelText('Point 1, in your words') as HTMLTextAreaElement;
    expect(box.value).toBe('I took the 5am bus home');
    expect(screen.getByText('Something that happened')).toBeTruthy();
    expect(screen.getByText('What gets in the way')).toBeTruthy();
    expect(screen.getAllByText('From what you said')).toHaveLength(1);
    expect(screen.getByText(source.text)).toBeTruthy();
    expect(screen.getAllByLabelText(/Counted only/)).toHaveLength(2);
    expect(screen.getAllByLabelText(/Shown without your name/)).toHaveLength(2);
    expect(screen.getAllByLabelText(/Shown with your name/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Add a point of your own' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'These are right' })).toHaveLength(1);
  });

  it('saves an edit when the box is left, and a change of visibility at once', async () => {
    const calls = server();
    show();
    const box = await screen.findByLabelText('Point 1, in your words');
    fireEvent.change(box, { target: { value: 'The 5am bus is late most days' } });
    fireEvent.blur(box);
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ url: `/api/points/${p1.id}`, body: { text: 'The 5am bus is late most days' } }));
    fireEvent.click(screen.getAllByLabelText(/Shown with your name/)[1]!);
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH')[1]).toMatchObject({ url: `/api/points/${p2.id}`, body: { visibility: 'named' } }));
  });

  it('scraps a point and can keep it after all', async () => {
    const calls = server();
    show();
    const scrap = await screen.findAllByRole('button', { name: 'Scrap this point' });
    fireEvent.click(scrap[1]!);
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'scrapped' }));
    expect(await screen.findByText('Scrapped. This point will not be shared.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep it after all' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH')[1]?.body).toEqual({ status: 'draft' }));
  });

  it('approves, saving words still being typed, then asks the two exit questions', async () => {
    const calls = server();
    show();
    const box = await screen.findByLabelText('Point 1, in your words');
    fireEvent.change(box, { target: { value: 'Late bus' } });
    fireEvent.click(screen.getByRole('button', { name: 'These are right' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/approve'))).toBe(true));
    const order = calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.url}`);
    expect(order.indexOf(`PATCH /api/points/${p1.id}`)).toBeLessThan(order.indexOf(`POST /api/conversations/${CID}/approve`));

    expect(await screen.findByText('Do these points sound like you?')).toBeTruthy();
    expect(screen.getByText('Did the interviewer push you in any direction?')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Mostly like me'));
    fireEvent.click(screen.getByLabelText('A little'));
    fireEvent.click(screen.getByRole('button', { name: 'Send my answers' }));
    await waitFor(() => expect(calls.find((c) => c.url.endsWith('/exit'))?.body).toEqual({ soundsLikeMe: 3, pushed: 'a_little' }));
    const picture = await screen.findByRole('link', { name: 'See the picture' });
    expect(picture.getAttribute('href')).toBe('/a/riverbend/picture');
  });

  it('adds a point of your own', async () => {
    const calls = server();
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Add a point of your own' }));
    fireEvent.change(screen.getByLabelText('Your point'), { target: { value: 'Record the classes' } });
    fireEvent.change(screen.getByLabelText('What kind of point is it?'), { target: { value: 'idea' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add this point' }));
    await waitFor(() => expect(calls.find((c) => c.url.endsWith('/points') && c.method === 'POST')?.body).toEqual({ type: 'idea', text: 'Record the classes' }));
  });

  it('asks for a name to show before approving a point shared with a name', async () => {
    const calls = server();
    show();
    await screen.findByLabelText('Point 1, in your words');
    expect(screen.queryByLabelText('The name to show beside your words')).toBeNull();
    fireEvent.click(screen.getAllByLabelText(/Shown with your name/)[0]!);
    const name = (await screen.findByLabelText('The name to show beside your words')) as HTMLInputElement;

    fireEvent.click(screen.getByRole('button', { name: 'These are right' }));
    expect(await screen.findByText('Give the name to show, or choose another way to show each point.')).toBeTruthy();
    expect(calls.some((c) => c.url.endsWith('/approve'))).toBe(false);

    fireEvent.change(name, { target: { value: ' Amina ' } });
    fireEvent.click(screen.getByRole('button', { name: 'These are right' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/approve'))).toBe(true));
    const saved = calls.findIndex((c) => c.method === 'PATCH' && c.url === '/api/me');
    expect(calls[saved]?.body).toEqual({ displayName: 'Amina' });
    expect(saved).toBeLessThan(calls.findIndex((c) => c.url.endsWith('/approve')));
  });
});
