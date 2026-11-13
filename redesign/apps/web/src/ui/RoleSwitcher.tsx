import { useState } from 'react';
import type { Role } from '@unite/shared';
import { api } from '../lib/api';
import { useMe } from '../lib/me';

/** The demo passcodes (UNITE_HOST_CODE and UNITE_STEWARD_CODE default to these in demo mode). */
const DEMO_CODES = { host: 'host', steward: 'steward' } as const;

const ROLES: { role: Role; label: string }[] = [
  { role: 'participant', label: 'Participant' },
  { role: 'host', label: 'Host' },
  { role: 'steward', label: 'Steward' },
];

/** Shown only when the server reports demo mode: switch between participant, host and steward. */
export function RoleSwitcher() {
  const { me, refresh } = useMe();
  const [error, setError] = useState<string>();
  if (!me?.demo) return null;
  const choose = async (role: Role) => {
    setError(undefined);
    try {
      if (role === 'participant') await api.del('/api/role');
      else await api.post('/api/role', { role, code: DEMO_CODES[role] });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="border-b border-line bg-soft text-xs sm:text-sm">
      <div className="mx-auto flex max-w-read flex-wrap items-center gap-x-2 gap-y-1 px-4 py-0.5 sm:gap-x-3 sm:py-1">
        <span id="role-switcher-label">Demo. View as:</span>
        <div role="group" aria-labelledby="role-switcher-label" className="flex gap-1">
          {ROLES.map(({ role, label }) => (
            <button
              key={role}
              type="button"
              aria-pressed={me.role === role}
              onClick={() => void choose(role)}
              className={`min-h-7 rounded-ui border px-1.5 py-0.5 sm:min-h-9 sm:px-2 sm:py-1 ${me.role === role ? 'border-ink bg-ink font-bold text-white' : 'border-muted bg-white text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {error && <span className="text-warn">{error}</span>}
      </div>
    </div>
  );
}
