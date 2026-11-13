import { useId, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { formatDate } from '@unite/shared';
import { api, ApiError, useApi } from '../../lib/api';
import { useAssembly } from '../../lib/useAssembly';
import { useLive } from '../../lib/useLive';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { Layout } from '../../ui/Layout';
import { Sources } from '../../ui/Sources';
import { StillNeeded } from '../../ui/StillNeeded';
import { Tag } from '../../ui/Tag';
import { NotHeard, ReportForm, ReportList } from '../picture/parts';
import { ANSWER_WORDS, AnswerBars, AnswerButtons, GroupBars, SETTLED, STATUS_TONE, STATUS_WORDS } from './parts';
import type { ObjectionView, ReasonView, StatementDetail } from './types';

const OBJECTION_STATUS: Record<ObjectionView['status'], string> = {
  open: 'Waiting for a reply',
  answered: 'Answered',
  sustained: 'Upheld: the statement must change',
  withdrawn: 'Withdrawn',
};

function ReasonColumn({ title, reasons, empty }: { title: string; reasons: ReasonView[]; empty: string }) {
  return (
    <div>
      <h3 className="mb-2">{title}</h3>
      {reasons.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {reasons.map((r) => (
            <li key={r.id} className="border-l-2 border-line pl-3">
              {r.text}
              {r.mine && <span className="block text-sm text-muted">Your reason</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddReason({ statementId, onAdded }: { statementId: string; onAdded: () => void }) {
  const [side, setSide] = useState<ReasonView['side']>('for');
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const legend = useId();
  const send = async () => {
    if (!text.trim()) return setError('Write your reason first.');
    setBusy(true);
    setError(undefined);
    try {
      await api.post(`/api/statements/${statementId}/reasons`, { side, text });
      setText('');
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Your reason could not be added. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="mt-6"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <fieldset className="mb-3" aria-labelledby={legend}>
        <legend id={legend} className="mb-1 font-bold">
          Add a reason
        </legend>
        <div className="flex flex-wrap gap-x-5">
          {(
            [
              ['for', 'A reason for'],
              ['against', 'A reason against'],
              ['question', 'A question'],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className="flex min-h-11 items-center gap-2">
              <input type="radio" name="reason-side" value={v} checked={side === v} onChange={() => setSide(v)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Your reason" hint={`${280 - text.length} characters left`} error={error}>
        <textarea className={inputClass} rows={3} maxLength={280} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <Button type="submit" variant="secondary" disabled={busy}>
        Add my reason
      </Button>
    </form>
  );
}

function RaiseObjection({ statementId, onRaised }: { statementId: string; onRaised: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!text.trim()) return setError('An objection needs a reason.');
    setBusy(true);
    setError(undefined);
    try {
      await api.post(`/api/statements/${statementId}/objections`, { text });
      setText('');
      onRaised();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Your objection could not be sent. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <Field label="Raise an objection" hint="An objection needs a reason. Say what is wrong with the statement and why. A steward must reply before it can pass." error={error}>
        <textarea className={inputClass} rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <Button type="submit" variant="secondary" disabled={busy}>
        Raise my objection
      </Button>
    </form>
  );
}

/** /a/:slug/statements/:id: one statement, what it still needs, its support, sources, reasons and objections. */
export default function Statement() {
  const { slug = '', id = '' } = useParams();
  const version = useLive(slug);
  const { data: view, reload: reloadView } = useAssembly(slug, version);
  const { data, error, reload } = useApi<StatementDetail>(`/api/statements/${encodeURIComponent(id)}`, version);
  const assembly = view?.assembly;
  const layout = (body: ReactNode, title: ReactNode = 'A statement', kicker: ReactNode = assembly?.question) => (
    <Layout title={title} assembly={assembly} kicker={kicker}>
      {body}
    </Layout>
  );

  if (error?.code === 'not_heard')
    return layout(
      <NotHeard
        slug={slug}
        isExample={assembly?.isExample}
        what="the statements and how people answered"
        onLookedAround={() => {
          reloadView();
          reload();
        }}
      />,
    );
  if (error && !data) return layout(<p>{error.message}</p>, error.status === 404 ? 'There is no statement here' : 'This statement could not be loaded');
  if (!data) return layout(<p aria-live="polite">Loading…</p>);

  const s = data.statement;
  const r = s.results;
  return layout(
    <>
      <p className="mb-6 flex flex-wrap gap-2">
        <Tag tone={STATUS_TONE[s.status]}>{STATUS_WORDS[s.status]}</Tag>
        {s.version > 1 && <Tag>Version {s.version}</Tag>}
        {s.mine && <Tag tone="accent">Your wording</Tag>}
      </p>

      <section aria-labelledby="answer" className="mb-8">
        <h2 id="answer" className="mb-2">
          Your answer
        </h2>
        {s.myReaction && <p className="mb-3">You answered: {ANSWER_WORDS[s.myReaction]}. You can change it.</p>}
        {!SETTLED.has(s.status) ? <AnswerButtons statement={s} size="small" onAnswered={() => reload()} /> : <p className="text-muted">This statement is settled.</p>}
      </section>

      <section aria-labelledby="needed" className="mb-8">
        <h2 id="needed" className="mb-2">
          What is still needed
        </h2>
        {r ? <StillNeeded items={r.stillNeeded} /> : <p className="text-muted">Answer to see how others answered and what is still needed.</p>}
      </section>

      {r && (
        <section aria-labelledby="support" className="mb-8">
          <h2 id="support" className="mb-3">
            How people answered
          </h2>
          <AnswerBars results={r} />
          <h3 className="mt-5 mb-2">Agreement among people who answered alike</h3>
          <GroupBars groups={r.groups} />
        </section>
      )}

      {(data.earlier.length > 0 || data.later.length > 0) && (
        <section aria-labelledby="versions" className="mb-8">
          <h2 id="versions" className="mb-2">
            Other versions
          </h2>
          {data.earlier.length > 0 && (
            <>
              <h3 className="mb-1">Earlier versions</h3>
              <ul className="mb-3 space-y-1">
                {data.earlier.map((e) => (
                  <li key={e.id}>
                    <Link to={`/a/${slug}/statements/${e.id}`}>
                      Version {e.version}: {e.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {data.later.length > 0 && (
            <>
              <h3 className="mb-1">New wordings of this statement</h3>
              <ul className="space-y-1">
                {data.later.map((e) => (
                  <li key={e.id}>
                    <Link to={`/a/${slug}/statements/${e.id}`}>
                      Version {e.version}: {e.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section aria-labelledby="sources" className="mb-8">
        <h2 id="sources" className="mb-2">
          What this rests on
        </h2>
        {data.sources.themes.length > 0 && (
          <p className="mb-1">
            From the picture: {data.sources.themes.map((t) => t.name).join('; ')}. <Link to={`/a/${slug}/picture`}>See the picture</Link>
          </p>
        )}
        <Sources people={data.sources.people} quotes={data.sources.quotes} />
      </section>

      <section aria-labelledby="reasons" className="mb-8">
        <h2 id="reasons" className="mb-1">
          Reasons
        </h2>
        <p className="mb-4 text-muted">In the order they arrived. Nothing here is ranked.</p>
        <div className="grid gap-6 md:grid-cols-2">
          <ReasonColumn title="For" reasons={data.reasons.for} empty="No reasons for yet." />
          <ReasonColumn title="Against" reasons={data.reasons.against} empty="No reasons against yet." />
        </div>
        {data.reasons.questions.length > 0 && (
          <div className="mt-6">
            <ReasonColumn title="Questions" reasons={data.reasons.questions} empty="" />
          </div>
        )}
        <AddReason statementId={s.id} onAdded={reload} />
      </section>

      <section aria-labelledby="objections" className="mb-8">
        <h2 id="objections" className="mb-2">
          Objections
        </h2>
        {data.objections.length === 0 ? (
          <p className="text-muted">No objections. If something in this statement is wrong, say what and why.</p>
        ) : (
          <ul className="space-y-3">
            {data.objections.map((o) => (
              <li key={o.id} className="rounded-ui border border-line p-3">
                <p>{o.text}</p>
                <p className="text-sm text-muted">
                  {OBJECTION_STATUS[o.status]}
                  {o.mine && ' · Your objection'} · {formatDate(o.createdAt)}
                </p>
                {o.reply && (
                  <p className="mt-2 border-l-2 border-accent pl-3">
                    <span className="font-bold">Reply{o.repliedBy ? ` from ${o.repliedBy}` : ''}:</span> {o.reply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <RaiseObjection statementId={s.id} onRaised={reload} />
      </section>

      <section aria-labelledby="report">
        <h2 id="report" className="mb-1">
          Is this what was said?
        </h2>
        <ReportList reports={data.reports} />
        <ReportForm targetType="statement" targetId={s.id} onSent={reload} />
      </section>

      <p className="mt-10">
        <Link to={`/a/${slug}/statements`}>Back to all statements</Link>
      </p>
    </>,
    s.text,
    `Statement${s.version > 1 ? `, version ${s.version}` : ''}`,
  );
}
