import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MeResponse, Role } from '@unite/shared';
import { useApi } from '../lib/api';
import { MeProvider, useMe } from '../lib/me';

const me = (role: Role): MeResponse => ({ person: null, memberships: [], role, demo: true });

afterEach(() => vi.unstubAllGlobals());

function Probe() {
  const { data } = useApi<{ n: number }>('/api/thing');
  const { refresh } = useMe();
  return (
    <>
      <p>Loaded {data?.n ?? 'nothing'}</p>
      <button type="button" onClick={() => void refresh()}>
        Refresh me
      </button>
    </>
  );
}

describe('useApi', () => {
  it('reads again when the viewer’s role changes, and only then', async () => {
    let role: Role = 'participant';
    let things = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/me') return new Response(JSON.stringify(me(role)), { status: 200, headers: { 'content-type': 'application/json' } });
        things += 1;
        return new Response(JSON.stringify({ n: things }), { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    );
    render(
      <MeProvider>
        <Probe />
      </MeProvider>,
    );
    await screen.findByText('Loaded 1');
    // The same viewer read again does not read the page again.
    await act(async () => screen.getByRole('button', { name: 'Refresh me' }).click());
    await waitFor(() => expect(screen.getByText('Loaded 1')).toBeTruthy());
    expect(things).toBe(1);
    // A new role does.
    role = 'steward';
    await act(async () => screen.getByRole('button', { name: 'Refresh me' }).click());
    await screen.findByText('Loaded 2');
    expect(things).toBe(2);
  });
});
