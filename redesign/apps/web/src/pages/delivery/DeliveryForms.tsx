import { useState, type FormEvent } from 'react';
import type { DeliveryItem } from '@unite/shared';
import { api } from '../../lib/api';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { useAction } from './useAction';
import { ITEM_STATUS_WORDS, KIND_WORDS } from './words';

/** The host adds a piece of delivery work: a title, its kind, a named owner and a due date. */
export function AddDeliveryItem({ decisionId, onDone }: { decisionId: string; onDone: () => void }) {
  const [f, setF] = useState({ title: '', kind: 'technology', owner: '', dueDate: '' });
  const [tried, setTried] = useState(false);
  const { busy, error, run } = useAction();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const need = (k: keyof typeof f) => (tried && !f[k].trim() ? 'This is needed.' : undefined);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!f.title.trim() || !f.owner.trim() || !f.dueDate) return;
    if (await run(() => api.post(`/api/decisions/${decisionId}/delivery`, { ...f, title: f.title.trim(), owner: f.owner.trim() }))) {
      setF({ title: '', kind: 'technology', owner: '', dueDate: '' });
      setTried(false);
      onDone();
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <Field label="What will be done" error={need('title')}>
        <input className={inputClass} value={f.title} onChange={set('title')} />
      </Field>
      <Field label="Kind">
        <select className={inputClass} value={f.kind} onChange={set('kind')}>
          <option value="technology">{KIND_WORDS.technology}</option>
          <option value="social">{KIND_WORDS.social}</option>
        </select>
      </Field>
      <Field label="Who owns it" hint="A named person who is accountable for it." error={need('owner')}>
        <input className={inputClass} value={f.owner} onChange={set('owner')} />
      </Field>
      <Field label="Due by" error={need('dueDate')}>
        <input type="date" className={inputClass} value={f.dueDate} onChange={set('dueDate')} />
      </Field>
      {error && (
        <Banner tone="warn" className="mb-4">
          {error}
        </Banner>
      )}
      <Button type="submit" variant="secondary" disabled={busy}>
        Add this work
      </Button>
    </form>
  );
}

/** The host posts an update on a piece of work, or moves it on. Done here is the host's word; only a check says it was delivered. */
export function UpdateDeliveryItem({ item, onDone }: { item: DeliveryItem; onDone: () => void }) {
  const [status, setStatus] = useState(item.status);
  const [update, setUpdate] = useState('');
  const { busy, error, run, setError } = useAction();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { ...(status !== item.status ? { status } : {}), ...(update.trim() ? { update: update.trim() } : {}) };
    if (Object.keys(body).length === 0) return setError('Change where it is, or write an update.');
    if (await run(() => api.patch(`/api/delivery/${item.id}`, body))) {
      setUpdate('');
      onDone();
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="mt-3 border-t border-line pt-3">
      <Field label="Where it is">
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as DeliveryItem['status'])}>
          {(Object.keys(ITEM_STATUS_WORDS) as DeliveryItem['status'][]).map((s) => (
            <option key={s} value={s}>
              {ITEM_STATUS_WORDS[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="An update (optional)">
        <textarea className={inputClass} rows={2} value={update} onChange={(e) => setUpdate(e.target.value)} />
      </Field>
      {error && (
        <Banner tone="warn" className="mb-4">
          {error}
        </Banner>
      )}
      <Button type="submit" variant="secondary" disabled={busy}>
        Save
      </Button>
    </form>
  );
}
