import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeProvider } from '../lib/me';
import StewardConsole from '../pages/steward/StewardConsole';
import { rankedIdsOf, statementsOf } from '../pages/steward/shapes';

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

  it('reads the likely shapes of other parts’ responses', () => {
    expect(statementsOf({ statements: [{ statement: { id: 'st_1', text: 'A' } }, { id: 'st_2', text: 'B', status: 'differ' }] })).toEqual([
      { id: 'st_1', text: 'A' },
      { id: 'st_2', text: 'B', status: 'differ' },
    ]);
    expect(rankedIdsOf({ ranked: [{ statementId: 'st_1', score: 3 }, { id: 'st_2' }] })).toEqual(['st_1', 'st_2']);
  });
});
