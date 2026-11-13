import { useState } from 'react';
import type { ReactionValue, StatementStatus } from '@unite/shared';
import { api, ApiError } from '../../lib/api';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { Bar } from '../picture/parts';
import type { GroupResult, StatementResults, StatementSummary } from '@unite/shared';

/** Pieces shared by the statements list and the statement page. */

export const STATUS_WORDS: Record<StatementStatus, string> = {
  candidate: 'New',
  common_ground: 'Common ground',
  differ: 'Where we differ',
  not_enough: 'Not enough voices yet',
  decided: 'Decided',
  no_agreement: 'No agreement',
  retired: 'Retired',
};

export const STATUS_TONE: Record<StatementStatus, 'agree' | 'disagree' | 'neutral'> = {
  candidate: 'neutral',
  common_ground: 'agree',
  differ: 'disagree',
  not_enough: 'neutral',
  decided: 'agree',
  no_agreement: 'disagree',
  retired: 'neutral',
};

export const ANSWER_WORDS: Record<ReactionValue, string> = { agree: 'Agree', disagree: 'Disagree', unsure: 'Not sure' };

/** Settled statements are not offered for answering one at a time. */
export const SETTLED: ReadonlySet<StatementStatus> = new Set(['decided', 'no_agreement', 'retired']);

/** Which of the three groups a statement is listed under. */
export function groupOf(status: StatementStatus): 'common' | 'differ' | 'notEnough' {
  if (status === 'common_ground' || status === 'decided') return 'common';
  if (status === 'differ' || status === 'no_agreement') return 'differ';
  return 'notEnough';
}

const pct = (share: number) => `${Math.round(share * 100)}%`;

/** How everyone answered one statement: three labelled bars. */
export function AnswerBars({ results }: { results: StatementResults }) {
  const o = results.overall;
  return (
    <div className="space-y-2">
      <p>
        {o.total === 1 ? '1 person has answered' : `${o.total} people have answered`}
        {results.counted < o.total && (
          <span className="block text-sm text-muted">
            {results.counted === 1 ? '1 of these answers counts' : `${results.counted} of these answers count`} toward the decision: those from people who joined with an
            invitation.
          </span>
        )}
      </p>
      <Bar label="Agree" value={o.agree} max={o.total} detail={`${o.agree} (${pct(o.total ? o.agree / o.total : 0)})`} tone="agree" />
      <Bar label="Disagree" value={o.disagree} max={o.total} detail={`${o.disagree} (${pct(o.total ? o.disagree / o.total : 0)})`} tone="disagree" />
      <Bar label="Not sure" value={o.unsure} max={o.total} detail={`${o.unsure} (${pct(o.total ? o.unsure / o.total : 0)})`} tone="unsure" />
    </div>
  );
}

/** "People who answered like you" and "people who answered differently", never named as groups. */
export function groupLabel(g: GroupResult, groups: GroupResult[]): string {
  if (groups.some((x) => x.mine)) return g.mine ? 'People who answered like you' : 'People who answered differently';
  return g.key === 'a' ? 'People who answered like the majority' : 'People who answered differently from the majority';
}

export function GroupBars({ groups }: { groups: GroupResult[] }) {
  if (groups.length < 2) return <p className="text-muted">People have not split into different ways of answering, so everyone is counted together.</p>;
  const ordered = [...groups].sort((a, b) => Number(b.mine) - Number(a.mine));
  return (
    <ul className="space-y-3">
      {ordered.map((g) => (
        <li key={g.key}>
          <Bar label={groupLabel(g, groups)} value={g.agree} max={g.total} tone="agree" detail={`${g.agree} of ${g.total} agree (${pct(g.share)})`} />
        </li>
      ))}
    </ul>
  );
}

/** Agree, disagree, not sure, and "Say it better". */
export function AnswerButtons({ statement, onAnswered, size = 'large' }: { statement: StatementSummary; onAnswered: (s: StatementSummary) => void; size?: 'large' | 'small' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [rewording, setRewording] = useState(false);
  const [text, setText] = useState(statement.text);
  const [reworded, setReworded] = useState(false);
  const answer = async (value: ReactionValue) => {
    setBusy(true);
    setError(undefined);
    try {
      const res = await api.post<{ statement: StatementSummary }>(`/api/statements/${statement.id}/reactions`, { value });
      onAnswered(res.statement);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Your answer could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const reword = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await api.post(`/api/statements/${statement.id}/rewordings`, { text });
      setReworded(true);
      setRewording(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Your wording could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const big = size === 'large' ? 'min-w-28 text-lg' : '';
  return (
    <div>
      <div className="flex flex-wrap gap-3" role="group" aria-label="Your answer">
        {(['agree', 'disagree', 'unsure'] as const).map((v) => (
          <Button key={v} variant="secondary" className={big} disabled={busy} onClick={() => void answer(v)} aria-pressed={statement.myReaction === v}>
            {ANSWER_WORDS[v]}
          </Button>
        ))}
        {!rewording && !reworded && (
          <Button variant="quiet" disabled={busy} onClick={() => setRewording(true)}>
            Say it better
          </Button>
        )}
      </div>
      {rewording && (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void reword();
          }}
        >
          <Field label="Your wording" hint="One sentence, at most 30 words. It becomes a new statement for others to answer, resting on the same points.">
            <textarea className={inputClass} rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="secondary" disabled={busy || !text.trim()}>
              Add my wording
            </Button>
            <Button variant="quiet" onClick={() => setRewording(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {reworded && (
        <p className="mt-3" role="status">
          Thank you. Your wording is now a statement others can answer. You can still answer this one.
        </p>
      )}
      {error && <p className="mt-2 font-bold text-warn">{error}</p>}
    </div>
  );
}
