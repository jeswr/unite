import { useId, useState } from 'react';
import { MEDIATION_LIMITS } from '@unite/shared';
import { api, ApiError } from '../../lib/api';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Field, inputClass } from '../../ui/Field';
import type { MediationDraftsBody, MediationView } from '@unite/shared';

type Key = 'reason' | 'wording' | 'question';

interface Item {
  text: string;
  scrapped: boolean;
}

const ITEMS: { key: Key; title: string; label: string; hint: string; max: number }[] = [
  {
    key: 'reason',
    title: 'A reason',
    label: 'Your reason, in your words',
    hint: 'It is added to the statement’s reasons, without your name.',
    max: MEDIATION_LIMITS.reason,
  },
  {
    key: 'wording',
    title: 'A wording others could agree with',
    label: 'Your wording, in your words',
    hint: 'It is added as a new wording of the statement, which everyone can answer.',
    max: MEDIATION_LIMITS.wordingChars,
  },
  {
    key: 'question',
    title: 'A question to check before deciding',
    label: 'Your question, in your words',
    hint: 'It is added to the statement’s questions.',
    max: MEDIATION_LIMITS.question,
  },
];

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : 'That did not go through. Please try again.');

/** "Here is what I heard": a reason (with its side), a wording and a question, each to edit or scrap, then "These are right". */
export function DraftsReview({ view, onChange }: { view: MediationView; onChange: (v: MediationView) => void }) {
  const m = view.mediation;
  const [items, setItems] = useState<Record<Key, Item>>(() => ({
    reason: { text: m.drafts.reason ?? '', scrapped: false },
    wording: { text: m.drafts.wording ?? '', scrapped: false },
    question: { text: m.drafts.question ?? '', scrapped: false },
  }));
  const [side, setSide] = useState<'for' | 'against' | undefined>(m.drafts.reasonSide);
  const [sideError, setSideError] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const sideName = useId();

  const valueOf = (k: Key) => (items[k].scrapped ? '' : items[k].text.trim());
  const set = (k: Key, patch: Partial<Item>) => setItems((all) => ({ ...all, [k]: { ...all[k], ...patch } }));
  const kept = ITEMS.filter((i) => valueOf(i.key));

  async function save(body: MediationDraftsBody) {
    setError(undefined);
    try {
      await api.patch<MediationView>(`/api/mediations/${m.id}/drafts`, body);
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function approve() {
    const reason = valueOf('reason');
    if (reason && !side) {
      setSideError('Choose whether your reason is for or against the statement.');
      return;
    }
    setSideError(undefined);
    setBusy(true);
    setError(undefined);
    try {
      await api.patch<MediationView>(`/api/mediations/${m.id}/drafts`, {
        reason,
        wording: valueOf('wording'),
        question: valueOf('question'),
        ...(side ? { reasonSide: side } : {}),
      });
      onChange(await api.post<MediationView>(`/api/mediations/${m.id}/approve`));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <>
      <p className="mb-5">
        This is what I took from what you said, in your words. Change anything that is not right, and scrap anything you do not want added. Nothing is added
        to the statement until you say these are right.
      </p>
      <div className="mb-5 rounded-ui border border-line bg-soft px-4 py-3">
        <p className="text-sm text-muted">The statement</p>
        <p className="font-bold">{view.statement.text}</p>
      </div>
      <ol className="mb-6 space-y-4" aria-label="What I heard">
        {ITEMS.map((it) => {
          const item = items[it.key];
          return (
            <Card as="li" key={it.key} className={item.scrapped ? 'bg-soft' : ''}>
              <h2 className="mb-2 text-lg">{it.title}</h2>
              {item.scrapped ? (
                <div>
                  {item.text && <p className="mb-2 text-muted line-through">{item.text}</p>}
                  <p className="mb-3">Scrapped. This will not be added.</p>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      set(it.key, { scrapped: false });
                      if (item.text.trim()) void save({ [it.key]: item.text.trim() });
                    }}
                  >
                    Keep it after all
                  </Button>
                </div>
              ) : (
                <>
                  <Field label={it.label} hint={item.text.trim() ? it.hint : 'I did not hear one. Write one if you like, or leave it empty.'}>
                    <textarea
                      rows={3}
                      className={inputClass}
                      value={item.text}
                      maxLength={it.max}
                      disabled={busy}
                      onChange={(e) => set(it.key, { text: e.target.value })}
                      onBlur={() => {
                        const t = item.text.trim();
                        if (t !== (m.drafts[it.key] ?? '')) void save({ [it.key]: t });
                      }}
                    />
                  </Field>
                  {it.key === 'reason' && item.text.trim() && (
                    <fieldset className="mb-3">
                      <legend className="mb-1 font-bold">Is your reason for or against the statement?</legend>
                      {sideError && <p className="mb-1 font-bold text-warn">{sideError}</p>}
                      <div className="flex flex-wrap gap-x-5">
                        {(
                          [
                            ['for', 'For the statement'],
                            ['against', 'Against the statement'],
                          ] as const
                        ).map(([v, label]) => (
                          <label key={v} className="flex min-h-11 items-center gap-2">
                            <input
                              type="radio"
                              name={sideName}
                              value={v}
                              checked={side === v}
                              disabled={busy}
                              className="h-5 w-5"
                              onChange={() => {
                                setSide(v);
                                setSideError(undefined);
                                void save({ reasonSide: v });
                              }}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  {item.text.trim() && (
                    <Button
                      variant="quiet"
                      className="-ml-4"
                      disabled={busy}
                      onClick={() => {
                        set(it.key, { scrapped: true });
                        void save({ [it.key]: '' });
                      }}
                    >
                      Scrap this
                    </Button>
                  )}
                </>
              )}
            </Card>
          );
        })}
      </ol>
      {error && (
        <Banner tone="warn" className="mb-4">
          {error}
        </Banner>
      )}
      {kept.length === 0 && <p className="mb-3">Nothing will be added to the statement. You can still say these are right, and you will have talked it through.</p>}
      <Button onClick={() => void approve()} disabled={busy}>
        {busy ? 'Saving…' : 'These are right'}
      </Button>
    </>
  );
}
