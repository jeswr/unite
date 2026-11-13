import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { formatDate } from '@unite/shared';
import { api, ApiError } from '../../lib/api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Field, inputClass } from '../../ui/Field';
import { personCount } from '../../ui/PersonCount';
import { Sources } from '../../ui/Sources';
import { Tag } from '../../ui/Tag';
import type { MissingGroup, Quote, ReportView, ThemeSection, ThemeView } from './types';

/** Pieces shared by the picture, open listening and statement pages. */

const SMALL = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** A number in words up to ten, in figures above: "three people", "48 people". */
export function peopleInWords(n: number): string {
  return `${n <= 10 ? SMALL[n] : n} ${n === 1 ? 'person' : 'people'}`;
}

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ not heard yet */

/** Rule 1, said plainly: what this page will show, and how to get there. */
export function NotHeard({ slug, isExample, what, onLookedAround }: { slug: string; isExample?: boolean; what: string; onLookedAround?: () => void }) {
  const [error, setError] = useState<string>();
  const lookAround = async () => {
    setError(undefined);
    try {
      await api.post(`/api/assemblies/${encodeURIComponent(slug)}/join`, { lookAroundFirst: true });
      onLookedAround?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work. Please try again.');
    }
  };
  return (
    <section aria-labelledby="not-heard">
      <h2 id="not-heard" className="mb-2">
        Have your own conversation first
      </h2>
      <p className="mb-2">You will see {what} once you have been heard.</p>
      <p className="mb-4 text-muted">
        This keeps everyone’s first answers their own. You say what matters to you before you read what anyone else said.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button to={`/a/${slug}/talk`}>Start my conversation</Button>
        {isExample && (
          <Button variant="secondary" onClick={() => void lookAround()}>
            Look around the example first
          </Button>
        )}
      </div>
      {error && <p className="mt-2 font-bold text-warn">{error}</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ quotes */

export function QuoteText({ q }: { q: Quote }) {
  return (
    <>
      <q>{q.text}</q>
      {q.textEn && <span className="block text-sm text-muted">In English: {q.textEn}</span>}
      {(q.mine || q.name) && <span className="block text-sm text-muted">{q.mine ? 'You said this' : q.name}</span>}
    </>
  );
}

export function QuoteList({ quotes, label }: { quotes: Quote[]; label?: string }) {
  if (quotes.length === 0) return null;
  return (
    <ul className="space-y-2" aria-label={label}>
      {quotes.map((q) => (
        <li key={q.id} className="border-l-2 border-line pl-3">
          <QuoteText q={q} />
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ bars */

/** A simple labelled bar. The words carry the number; the bar only shows it. */
export function Bar({ label, value, max, detail, tone = 'accent' }: { label: ReactNode; value: number; max: number; detail: ReactNode; tone?: 'accent' | 'agree' | 'disagree' | 'unsure' | 'warn' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const fill = { accent: 'bg-accent', agree: 'bg-agree', disagree: 'bg-disagree', unsure: 'bg-unsure', warn: 'bg-warn' }[tone];
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-x-3">
        <span>{label}</span>
        <span className="text-muted">{detail}</span>
      </div>
      <div aria-hidden="true" className="mt-1 h-3 w-full rounded-ui border border-line bg-soft">
        <div className={`h-full rounded-ui ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** "Who we have not heard from": each affected group against its target. */
export function MissingBars({ groups }: { groups: MissingGroup[] }) {
  if (groups.length === 0) return null;
  const under = groups.filter((g) => g.underHeard);
  return (
    <section aria-labelledby="missing" className="mt-10">
      <h2 id="missing" className="mb-2">
        Who we have not heard from
      </h2>
      <p className="mb-4 text-muted">
        {under.length === 0
          ? 'Every group the host named has been heard at least half as much as hoped.'
          : `Some groups have been heard less than half as much as hoped. The picture is not reweighted: they are invited to take part.`}
      </p>
      <ul className="space-y-4">
        {groups.map((g) => (
          <li key={g.key}>
            <Bar
              label={
                <>
                  {g.label} {g.underHeard && <Tag tone="warn">Under-heard</Tag>}
                </>
              }
              value={g.heard}
              max={Math.max(g.target, g.heard)}
              tone={g.underHeard ? 'warn' : 'accent'}
              detail={`${g.heard} of ${g.target} hoped for`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ reports */

export const REPORT_KINDS: { kind: ReportView['kind']; label: string }[] = [
  { kind: 'missing', label: 'Something is missing' },
  { kind: 'added', label: 'Something was added that nobody said' },
  { kind: 'emphasis', label: 'The emphasis is wrong' },
  { kind: 'count', label: 'The count is wrong' },
  { kind: 'other', label: 'Something else' },
];

const REPORT_STATUS: Record<ReportView['status'], string> = { open: 'Waiting for a steward', upheld: 'Upheld', not_upheld: 'Not upheld' };

/** Reports shown beside the thing reported, with their outcome. Never says who reported. */
export function ReportList({ reports }: { reports: ReportView[] }) {
  if (reports.length === 0) return null;
  return (
    <div className="mt-3 rounded-ui border border-line bg-soft p-3">
      <p className="mb-1 font-bold">Reported as not what was said</p>
      <ul className="space-y-2">
        {reports.map((r) => (
          <li key={r.id}>
            <p>
              {REPORT_KINDS.find((k) => k.kind === r.kind)?.label}: {r.text}
              {r.mine && <span className="text-muted"> (you reported this)</span>}
            </p>
            <p className="text-sm text-muted">
              {REPORT_STATUS[r.status]}
              {r.outcomeNote && `: ${r.outcomeNote}`}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "This is not what was said": opens a short form. */
export function ReportForm({ targetType, targetId, onSent }: { targetType: 'theme' | 'statement' | 'decision'; targetId: string; onSent?: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ReportView['kind']>();
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const legend = useId();
  if (sent) return <p className="mt-2 text-muted" role="status">Thank you. A steward will look at this and say what they decided, here.</p>;
  if (!open)
    return (
      <Button variant="quiet" className="mt-2 !px-0" onClick={() => setOpen(true)}>
        This is not what was said
      </Button>
    );
  const send = async () => {
    if (!kind) return setError('Choose what is wrong.');
    if (!text.trim()) return setError('Say briefly what is wrong.');
    setBusy(true);
    setError(undefined);
    try {
      await api.post('/api/reports', { targetType, targetId, kind, text });
      setSent(true);
      onSent?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That could not be sent. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="mt-3 rounded-ui border border-line p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <fieldset className="mb-4" aria-labelledby={legend}>
        <legend id={legend} className="mb-1 font-bold">
          What is wrong?
        </legend>
        {REPORT_KINDS.map((k) => (
          <label key={k.kind} className="flex min-h-11 items-center gap-2">
            <input type="radio" name={`kind-${targetId}`} value={k.kind} checked={kind === k.kind} onChange={() => setKind(k.kind)} />
            {k.label}
          </label>
        ))}
      </fieldset>
      <Field label="Say what was said, or what is wrong" error={error}>
        <textarea className={inputClass} rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="secondary" disabled={busy}>
          Send to a steward
        </Button>
        <Button variant="quiet" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ themes */

/** One theme: its name in the participants' words, how many people, sentences with sources, quotes. */
export function ThemeCard({ theme, canReport = true, onChange }: { theme: ThemeView; canReport?: boolean; onChange?: () => void }) {
  return (
    <Card as="li" className="list-none">
      <h3 className="mb-1">{capitalise(theme.name)}</h3>
      <p className="mb-3 text-muted">{personCount(theme.people)}</p>
      {theme.hostedBy && theme.hostedBy.length > 0 && (
        <p className="mb-3">
          An assembly is answering this:{' '}
          {theme.hostedBy.map((h, i) => (
            <span key={h.slug}>
              {i > 0 && ', '}
              <Link to={`/a/${h.slug}`}>{h.title}</Link>
            </span>
          ))}
        </p>
      )}
      {theme.sentences.length > 0 && (
        <ul className="mb-3 space-y-2">
          {theme.sentences.map((s, i) => (
            <li key={i}>
              <p>{s.text}</p>
              <Sources people={s.people} quotes={s.quotes} />
            </li>
          ))}
        </ul>
      )}
      <QuoteList quotes={theme.quotes} label={`What people said about ${theme.name}`} />
      {theme.mine.filter((m) => !theme.quotes.some((q) => q.id === m.id)).length > 0 && (
        <ul className="mt-2 space-y-2">
          {theme.mine
            .filter((m) => !theme.quotes.some((q) => q.id === m.id))
            .map((m) => (
              <li key={m.id} className="border-l-2 border-accent pl-3">
                <q>{m.text}</q>
                <span className="block text-sm font-bold text-accent">You said this</span>
              </li>
            ))}
        </ul>
      )}
      <ReportList reports={theme.reports} />
      {canReport && <ReportForm targetType="theme" targetId={theme.id} onSent={onChange} />}
    </Card>
  );
}

/** The steward's confirmation, as everyone sees it. */
export function ConfirmedLine({ confirmed }: { confirmed: { at: string; by: string } | null }) {
  return confirmed ? (
    <p className="mb-4">
      <Tag tone="agree">Checked</Tag> {confirmed.by} confirmed on {formatDate(confirmed.at)} that this picture is faithful to what people said.
    </p>
  ) : (
    <p className="mb-4 text-muted">A steward has not yet confirmed that this picture is faithful to what people said.</p>
  );
}

/** The four kinds of theme, in order, each a list of theme cards. */
export function ThemeSections({ sections, canReport, onChange }: { sections: ThemeSection[]; canReport: boolean; onChange?: () => void }) {
  return (
    <>
      {sections.map((s) => (
        <section key={s.kind} aria-labelledby={`kind-${s.kind}`} className="mt-8">
          <h2 id={`kind-${s.kind}`} className="mb-3">
            {s.title}
          </h2>
          {s.themes.length === 0 ? (
            <p className="text-muted">No themes here yet.</p>
          ) : (
            <ul className="space-y-4">
              {s.themes.map((t) => (
                <ThemeCard key={t.id} theme={t} canReport={canReport} onChange={onChange} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

