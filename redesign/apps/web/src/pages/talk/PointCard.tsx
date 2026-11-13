import { useId, useState, type FormEvent } from 'react';
import type { Point, PointType, Turn } from '@unite/shared';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Field, inputClass } from '../../ui/Field';
import { POINT_TYPE_LABELS, POINT_TYPES, VISIBILITY_CHOICES } from './words';

export interface PointDraft {
  text: string;
  visibility: Point['visibility'];
  status: Point['status'];
}

interface Props {
  index: number;
  point: Pick<Point, 'id' | 'type' | 'sourceTurnIds'>;
  draft: PointDraft;
  /** The person's own turns this point came from. */
  sources: Pick<Turn, 'id' | 'text'>[];
  onText: (text: string) => void;
  /** Called when the text box loses focus, to save. */
  onTextDone?: () => void;
  onVisibility: (v: Point['visibility']) => void;
  onStatus: (s: 'draft' | 'scrapped') => void;
  disabled?: boolean;
}

/** One point to check: its words (editable), its type in words, where it came from, how it is shown, keep or scrap. */
export function PointCard({ index, point, draft, sources, onText, onTextDone, onVisibility, onStatus, disabled }: Props) {
  const scrapped = draft.status === 'scrapped';
  const name = useId();
  return (
    <Card as="li" className={scrapped ? 'bg-soft' : ''}>
      <p className="mb-2 text-sm font-bold text-muted">{POINT_TYPE_LABELS[point.type]}</p>
      {scrapped ? (
        <div>
          <p className="mb-2 text-muted line-through">{draft.text}</p>
          <p className="mb-3">Scrapped. This point will not be shared.</p>
          <Button variant="secondary" onClick={() => onStatus('draft')} disabled={disabled}>
            Keep it after all
          </Button>
        </div>
      ) : (
        <>
          <Field label={`Point ${index + 1}, in your words`}>
            <textarea
              rows={3}
              className={inputClass}
              value={draft.text}
              maxLength={400}
              disabled={disabled}
              onChange={(e) => onText(e.target.value)}
              onBlur={onTextDone}
            />
          </Field>
          {sources.length > 0 ? (
            <details className="mb-4">
              <summary className="cursor-pointer text-accent underline underline-offset-2">From what you said</summary>
              <ul className="mt-2 space-y-2">
                {sources.map((t) => (
                  <li key={t.id} className="border-l-4 border-line pl-3 whitespace-pre-wrap">
                    {t.text}
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="mb-4 text-sm text-muted">You wrote this point yourself.</p>
          )}
          <fieldset className="mb-3">
            <legend className="mb-1 font-bold">How it is shown</legend>
            <div className="space-y-1">
              {VISIBILITY_CHOICES.map((v) => (
                <label key={v.value} className="flex gap-3 py-1">
                  <input
                    type="radio"
                    name={name}
                    value={v.value}
                    checked={draft.visibility === v.value}
                    onChange={() => onVisibility(v.value)}
                    disabled={disabled}
                    className="mt-1.5 h-5 w-5 shrink-0"
                  />
                  <span>
                    <span className="block">{v.label}</span>
                    <span className="block text-sm text-muted">{v.line}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Button variant="quiet" onClick={() => onStatus('scrapped')} disabled={disabled} className="-ml-4">
            Scrap this point
          </Button>
        </>
      )}
    </Card>
  );
}

/** "Add a point of your own". */
export function AddPointForm({ onAdd, disabled }: { onAdd: (p: { type: PointType; text: string }) => Promise<void> | void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PointType>('matters');
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  if (!open)
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} disabled={disabled}>
        Add a point of your own
      </Button>
    );
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setError('Write the point first.');
    setError(undefined);
    await onAdd({ type, text: text.trim() });
    setText('');
    setOpen(false);
  }
  return (
    <Card as="section">
      <form onSubmit={submit}>
        <h3 className="mb-3">A point of your own</h3>
        <Field label="What kind of point is it?">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as PointType)}>
            {POINT_TYPES.map((t) => (
              <option key={t} value={t}>
                {POINT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Your point" hint="One idea, in your own words." error={error}>
          <textarea rows={3} className={inputClass} value={text} onChange={(e) => setText(e.target.value)} maxLength={400} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" type="submit" disabled={disabled}>
            Add this point
          </Button>
          <Button variant="quiet" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
