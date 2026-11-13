import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Priorities, { capacityLine } from '../pages/deciding/Priorities';
import type { PrioritiesResponse } from '../pages/deciding/types';

const st = (n: number) => ({ id: `st_${String(n).padStart(12, '0')}`, text: `Statement number ${n}`, status: 'common_ground' });
const body = (over: Partial<PrioritiesResponse> = {}): PrioritiesResponse => ({
  statements: [1, 2, 3, 4, 5].map(st),
  ranked: [1, 2, 3, 4, 5].map((n, i) => ({ statementId: st(n).id, text: st(n).text, status: 'common_ground', round: i + 1, score: 10 - i * 2 })),
  myChoices: [],
  myChoicesCount: true,
  chosen: 31,
  invited: 48,
  uninvitedChosen: 0,
  capacity: 3,
  replyBy: '2026-12-18',
  closed: false,
  ...over,
});

function mock(data: PrioritiesResponse) {
  const calls: { url: string; method: string; body?: string }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body as string | undefined });
      const u = String(url);
      if (u.endsWith('/version')) return new Response(JSON.stringify({ version: 1 }));
      if (u.endsWith('/priorities')) return new Response(JSON.stringify(data));
      return new Response(JSON.stringify({ error: { code: 'not_found', message: 'no' } }), { status: 404 });
    }),
  );
  return calls;
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/a/earning-and-learning/priorities']}>
      <Routes>
        <Route path="/a/:slug/priorities" element={<Priorities />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => vi.unstubAllGlobals());

describe('priorities page', () => {
  it('limits choices to three with a clear count, and saves them', async () => {
    const calls = mock(body());
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Which three matter most to you?' })).toBeTruthy();
    const boxes = await screen.findAllByRole('checkbox');
    expect(boxes).toHaveLength(5);
    expect(screen.getByText('0 of 3 chosen')).toBeTruthy();
    fireEvent.click(boxes[0]!);
    fireEvent.click(boxes[2]!);
    expect(screen.getByText('2 of 3 chosen')).toBeTruthy();
    fireEvent.click(boxes[4]!);
    expect(screen.getByText(/3 of 3 chosen/)).toBeTruthy();
    // The other two are now disabled and clicking does nothing.
    expect((boxes[1] as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(boxes[1]!);
    expect((boxes[1] as HTMLInputElement).checked).toBe(false);
    // Untick one, and another can be chosen.
    fireEvent.click(boxes[0]!);
    expect((boxes[1] as HTMLInputElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Save my choices' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(JSON.parse(put.body!)).toEqual({ statementIds: [st(3).id, st(5).id] });
  });

  it('shows the ranked list with the capacity line and how many have chosen, no scores as numbers', async () => {
    mock(body());
    renderPage();
    expect(await screen.findByText('31 of 48 invited people have chosen.')).toBeTruthy();
    expect(screen.getByTestId('capacity-line').textContent).toMatch(/The host has pledged to answer the top 3 by 18 December 2026/);
    expect(screen.getByText(/smaller groups’ priorities reach the top too/)).toBeTruthy();
    const ranked = screen.getByRole('heading', { name: 'The list so far' }).parentElement!;
    expect(ranked.textContent).not.toMatch(/\b10\b|\b8\b/);
  });

  it('says when nothing has reached common ground yet', async () => {
    mock(body({ statements: [], ranked: [] }));
    renderPage();
    expect(await screen.findByText('Nothing to choose from yet')).toBeTruthy();
  });

  it('words the capacity line', () => {
    expect(capacityLine(5, '2026-12-18')).toBe('The host has pledged to answer the top 5 by 18 December 2026');
    expect(capacityLine(null, null)).toBeNull();
  });
});
