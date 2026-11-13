import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeProvider } from '../lib/me';
import StewardConsole from '../pages/steward/StewardConsole';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const notBuilt = () => json({ error: { code: 'not_built', message: 'This part of Unite is still being built.' } }, 501);

const view = {
  assembly: { slug: 'tool', title: 'Volunteering tool', hostName: 'Northern Network', stage: 'picture', pledge: null },
  checklist: { stage: 'picture', items: [], clear: false },
};

afterEach(() => vi.unstubAllGlobals());

describe('the steward console', () => {
  it('asks for the passcode first', () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ assemblies: [] })));
    render(
      <MemoryRouter>
        <MeProvider initial={{ person: null, memberships: [], role: 'participant', demo: false }}>
          <StewardConsole />
        </MeProvider>
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('Passcode')).toBeTruthy();
  });

  it('lists the jobs and says plainly when a part is not switched on yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/assemblies') return json({ assemblies: [{ slug: 'tool', title: 'Volunteering tool', hostName: 'Northern Network', stage: 'picture', isOpenListening: false }] });
        if (url === '/api/assemblies/tool') return json(view);
        if (url === '/api/assemblies/tool/decisions') return json({ assembly: view.assembly, decisions: [] });
        return notBuilt();
      }),
    );
    render(
      <MemoryRouter>
        <MeProvider initial={{ person: null, memberships: [], role: 'steward', demo: false }}>
          <StewardConsole />
        </MeProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /See the jobs/ }));
    expect(await screen.findByRole('heading', { name: 'Jobs for Volunteering tool' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Update the picture' })[0]!);
    expect(await screen.findAllByText('This part is not switched on yet.')).not.toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Turn priorities into decisions' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Record a check/ })).toBeTruthy();
  });

  it('writes up the top common-ground priorities and sends them as the decide endpoint expects', async () => {
    const posts: { url: string; body: unknown }[] = [];
    const ranked = [
      { statementId: 'st_a', text: 'Childcare in every class', status: 'common_ground', round: 1, score: 9 },
      { statementId: 'st_b', text: 'Already decided', status: 'decided', round: 2, score: 7 },
      { statementId: 'st_c', text: 'Paid learning hours', status: 'common_ground', round: 3, score: 5 },
      { statementId: 'st_d', text: 'Nobody chose this', status: 'common_ground', round: 4, score: 0 },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posts.push({ url, body: JSON.parse(String(init.body)) });
          return json({ decisions: [] }, 201);
        }
        if (url === '/api/assemblies') return json({ assemblies: [{ slug: 'tool', title: 'Volunteering tool', hostName: 'Northern Network', stage: 'deciding', isOpenListening: false }] });
        if (url === '/api/assemblies/tool') return json({ ...view, assembly: { ...view.assembly, stage: 'deciding', pledge: { capacity: 2 } } });
        if (url === '/api/assemblies/tool/priorities') return json({ statements: [], ranked, myChoices: [], myChoicesCount: false, chosen: 3, invited: 4, uninvitedChosen: 0, capacity: 2, replyBy: null, closed: false });
        if (url === '/api/assemblies/tool/decisions') return json({ assembly: view.assembly, decisions: [] });
        if (url === '/api/assemblies/tool/reports') return json({ reports: [] });
        if (url === '/api/assemblies/tool/statements') return json({ statements: [], canSteward: true });
        return notBuilt();
      }),
    );
    render(
      <MemoryRouter>
        <MeProvider initial={{ person: null, memberships: [], role: 'steward', demo: false }}>
          <StewardConsole />
        </MeProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /See the jobs/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Prepare the decisions' }));
    const first = (await screen.findByRole('group', { name: 'Decision 1' })) as HTMLElement;
    const second = screen.getByRole('group', { name: 'Decision 2' }) as HTMLElement;
    expect(screen.queryByRole('group', { name: 'Decision 3' })).toBeNull();
    expect(within(first).getByText('From the statement: Childcare in every class')).toBeTruthy();
    expect(within(second).getByText('From the statement: Paid learning hours')).toBeTruthy();
    for (const [box, test] of [
      [first, 'A class near every centre has childcare'],
      [second, 'Workers get ten paid hours a term'],
    ] as const) {
      fireEvent.change(within(box).getByLabelText(/^Why/), { target: { value: 'People asked for it.' } });
      fireEvent.change(within(box).getByLabelText(/^Tests for/), { target: { value: test } });
      fireEvent.click(within(box).getByLabelText('A social arrangement'));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Write up the decisions' }));
    expect(await screen.findByText(/2 decisions are written up/)).toBeTruthy();
    expect(posts).toEqual([
      {
        url: '/api/assemblies/tool/decide',
        body: {
          decisions: {
            st_a: { title: 'Childcare in every class', why: 'People asked for it.', options: [], dissent: '', tests: ['A class near every centre has childcare'], delivery: ['social'] },
            st_c: { title: 'Paid learning hours', why: 'People asked for it.', options: [], dissent: '', tests: ['Workers get ten paid hours a term'], delivery: ['social'] },
          },
        },
      },
    ]);
  });
});
