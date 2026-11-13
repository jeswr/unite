import { useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../../lib/api';
import { useMe } from '../../lib/me';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { useAction } from '../delivery/useAction';

/** Shows `children` once the role cookie is set; otherwise asks for the passcode (POST /api/role). */
export function PasscodeGate({ role, children }: { role: 'host' | 'steward'; children: ReactNode }) {
  const { me, refresh } = useMe();
  const [code, setCode] = useState('');
  const { busy, error, run } = useAction();

  if (!me) return <p aria-live="polite">Loading…</p>;
  if (me.role === role) return <>{children}</>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => api.post('/api/role', { role, code }))) {
      setCode('');
      await refresh();
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="max-w-md">
      <p className="mb-4">
        {role === 'host'
          ? 'This page is for organisations that host assemblies. Enter the host passcode to go on.'
          : 'This page is for the stewards who look after assemblies. Enter the steward passcode to go on.'}
      </p>
      <Field label="Passcode">
        <input type="password" autoComplete="current-password" className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
      {error && (
        <Banner tone="warn" className="mb-4">
          {error}
        </Banner>
      )}
      <Button type="submit" disabled={busy || !code}>
        Go on
      </Button>
    </form>
  );
}
