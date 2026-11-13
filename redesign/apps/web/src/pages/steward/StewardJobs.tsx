import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Objection, Report } from '@unite/shared';
import { api } from '../../lib/api';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { checkable } from '../delivery/Decision';
import type { DecisionRecord, DecisionsResponse } from '../delivery/types';
import { messageOf, useAction } from '../delivery/useAction';
import { objectionsOf, rankedIdsOf, reportsOf, statementsOf, type StatementLite } from './shapes';

function Job({ title, about, count, children }: { title: string; about: string; count?: string; children: ReactNode }) {
  return (
    <li className="border-b border-line py-4">
      <h3 className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span>{title}</span>
        {count && <span className="text-base font-normal text-muted">{count}</span>}
      </h3>
      <p className="mb-3 text-muted">{about}</p>
      {children}
    </li>
  );
}

function Result({ error, done }: { error?: string; done?: string }) {
  return (
    <div aria-live="polite">
      {error && (
        <Banner tone="warn" className="mt-3">
          {error}
        </Banner>
      )}
      {!error && done && (
        <Banner className="mt-3">
          {done}
        </Banner>
      )}
    </div>
  );
}

/** A job that is one call: a button, then what happened. */
function ActionJob({ title, about, label, path, done }: { title: string; about: string; label: string; path: string; done: string }) {
  const { busy, error, run } = useAction();
  const [ok, setOk] = useState<string>();
  return (
    <Job title={title} about={about}>
      <Button variant="secondary" disabled={busy} onClick={() => void run(() => api.post(path)).then((r) => setOk(r !== undefined ? done : undefined))}>
        {label}
      </Button>
      <Result error={error} done={ok} />
    </Job>
  );
}

function ReportsJob({ slug }: { slug: string }) {
  const [reports, setReports] = useState<Report[]>();
  const [loadError, setLoadError] = useState<string>();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { busy, error, run } = useAction();
  const load = () =>
    api
      .get(`/api/assemblies/${slug}/reports`)
      .then((b) => setReports(reportsOf(b)))
      .catch((e) => setLoadError(messageOf(e)));
  useEffect(() => void load(), [slug]);
  const waiting = reports?.filter((r) => r.status === 'open') ?? [];
  const resolve = (r: Report, status: 'upheld' | 'not_upheld') =>
    void run(() => api.patch(`/api/reports/${r.id}`, { status, outcomeNote: (notes[r.id] ?? '').trim() })).then((x) => {
      if (x !== undefined) void load();
    });
  return (
    <Job title="Reports that the picture is wrong" about="People’s reports that something was missing, added, given the wrong weight or miscounted." count={reports ? `${waiting.length} open` : undefined}>
      {loadError && <Result error={loadError} />}
      {reports && waiting.length === 0 && <p>No report is waiting.</p>}
      {waiting.length > 0 && (
        <Button variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide the open reports' : 'Open the reports'}
        </Button>
      )}
      {open && (
        <ul className="mt-3 space-y-3">
          {waiting.map((r) => (
            <li key={r.id} className="rounded-ui border border-line p-3">
              <p className="mb-2">{r.text}</p>
              <Field label="What you found">
                <textarea className={inputClass} rows={2} value={notes[r.id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => resolve(r, 'upheld')}>
                  Uphold it
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => resolve(r, 'not_upheld')}>
                  Do not uphold it
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Result error={error} />
    </Job>
  );
}

function ObjectionsJob({ slug }: { slug: string }) {
  const [items, setItems] = useState<{ o: Objection; statement: string }[]>();
  const [replies, setReplies] = useState<Record<string, string>>({});
  const { busy, error, run } = useAction();
  const find = () =>
    run(async () => {
      const list = statementsOf(await api.get(`/api/assemblies/${slug}/statements`));
      const found: { o: Objection; statement: string }[] = [];
      for (const s of list) for (const o of objectionsOf(await api.get(`/api/statements/${s.id}`))) if (o.status === 'open') found.push({ o, statement: s.text });
      setItems(found);
      return found;
    });
  const reply = (o: Objection, status: 'answered' | 'sustained') =>
    void run(() => api.patch(`/api/objections/${o.id}`, { reply: (replies[o.id] ?? '').trim(), status })).then((x) => {
      if (x !== undefined) void find();
    });
  return (
    <Job title="Objections" about="Reasoned objections to a statement. Each needs a reply before the assembly can move on." count={items ? `${items.length} open` : undefined}>
      <Button variant="secondary" disabled={busy} onClick={() => void find()}>
        Open the objections
      </Button>
      {items && items.length === 0 && <p className="mt-3">No objection is waiting for a reply.</p>}
      {items && items.length > 0 && (
        <ul className="mt-3 space-y-3">
          {items.map(({ o, statement }) => (
            <li key={o.id} className="rounded-ui border border-line p-3">
              <p className="text-sm text-muted">On: {statement}</p>
              <p className="mb-2">{o.text}</p>
              <Field label="Your reply">
                <textarea className={inputClass} rows={2} value={replies[o.id] ?? ''} onChange={(e) => setReplies({ ...replies, [o.id]: e.target.value })} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={busy || !replies[o.id]?.trim()} onClick={() => reply(o, 'answered')}>
                  Send the reply
                </Button>
                <Button variant="secondary" disabled={busy || !replies[o.id]?.trim()} onClick={() => reply(o, 'sustained')}>
                  Uphold the objection
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Result error={error} />
    </Job>
  );
}

function RoomJob({ slug }: { slug: string }) {
  const [topic, setTopic] = useState('');
  const [minutes, setMinutes] = useState('45');
  const [statementId, setStatementId] = useState('');
  const [statements, setStatements] = useState<StatementLite[]>([]);
  const [ok, setOk] = useState<string>();
  const { busy, error, run } = useAction();
  useEffect(() => {
    api.get(`/api/assemblies/${slug}/statements`).then((b) => setStatements(statementsOf(b)), () => setStatements([]));
  }, [slug]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setOk(undefined);
    const body = { topic: topic.trim(), minutes: Number(minutes) || 45, ...(statementId ? { statementId } : {}) };
    if ((await run(() => api.post(`/api/assemblies/${slug}/rooms`, body))) !== undefined) {
      setOk('The room is drawn. Its members are chosen by lot from invited participants.');
      setTopic('');
    }
  };
  return (
    <Job title="Draw a room" about="A small room of people who answered differently, drawn by lot, to work through one statement.">
      <form onSubmit={(e) => void submit(e)}>
        <Field label="What the room will work on">
          <input className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value)} />
        </Field>
        {statements.length > 0 && (
          <Field label="The statement (optional)">
            <select className={inputClass} value={statementId} onChange={(e) => setStatementId(e.target.value)}>
              <option value="">None</option>
              {statements.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.text}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="How long, in minutes">
          <input type="number" min={10} className={inputClass} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" disabled={busy || !topic.trim()}>
          Draw the room
        </Button>
      </form>
      <Result error={error} done={ok} />
    </Job>
  );
}

interface DecisionDraft {
  statementId: string;
  text: string;
  title: string;
  why: string;
  options: string;
  dissent: string;
  tests: string;
  technology: boolean;
  social: boolean;
}

const lines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

function DecideJob({ slug, capacity }: { slug: string; capacity: number }) {
  const [drafts, setDrafts] = useState<DecisionDraft[]>();
  const [ok, setOk] = useState<string>();
  const [tried, setTried] = useState(false);
  const { busy, error, run } = useAction();

  const prepare = () =>
    run(async () => {
      const [prio, stmts] = await Promise.all([api.get(`/api/assemblies/${slug}/priorities`), api.get(`/api/assemblies/${slug}/statements`)]);
      const byId = new Map(statementsOf(stmts).map((s) => [s.id, s]));
      const top = rankedIdsOf(prio)
        .map((id) => byId.get(id))
        .filter((s): s is StatementLite => !!s && (!s.status || s.status === 'common_ground'))
        .slice(0, capacity);
      setDrafts(top.map((s) => ({ statementId: s.id, text: s.text, title: s.text, why: '', options: '', dissent: '', tests: '', technology: false, social: false })));
      return top;
    });

  const set = (i: number, patch: Partial<DecisionDraft>) => setDrafts((d) => d?.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const incomplete = (d: DecisionDraft) => !d.title.trim() || !d.why.trim() || lines(d.tests).length === 0 || (!d.technology && !d.social);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!drafts || drafts.some(incomplete)) return;
    const body = {
      decisions: drafts.map((d) => ({
        statementId: d.statementId,
        title: d.title.trim(),
        why: d.why.trim(),
        options: lines(d.options),
        dissent: d.dissent.trim(),
        tests: lines(d.tests).map((text, k) => ({ n: k + 1, text })),
        delivery: [...(d.technology ? ['technology'] : []), ...(d.social ? ['social'] : [])],
      })),
    };
    if ((await run(() => api.post(`/api/assemblies/${slug}/decide`, body))) !== undefined) {
      setOk(`${drafts.length === 1 ? 'The decision is' : `${drafts.length} decisions are`} written up and waiting for the host’s answer.`);
      setDrafts(undefined);
    }
  };

  return (
    <Job title="Turn priorities into decisions" about={`The top ${capacity} priorities that are common ground become decisions, each with numbered tests for “done”.`}>
      {!drafts && (
        <Button variant="secondary" disabled={busy} onClick={() => void prepare()}>
          Prepare the decisions
        </Button>
      )}
      {drafts && drafts.length === 0 && <p>No priority is common ground yet.</p>}
      {drafts && drafts.length > 0 && (
        <form onSubmit={(e) => void submit(e)} noValidate>
          {drafts.map((d, i) => (
            <fieldset key={d.statementId} className="mb-6 rounded-ui border border-line p-3">
              <legend className="px-1 font-bold">Decision {i + 1}</legend>
              <p className="mb-3 text-muted">From the statement: {d.text}</p>
              <Field label="What was decided, in one sentence" error={tried && !d.title.trim() ? 'This is needed.' : undefined}>
                <textarea className={inputClass} rows={2} value={d.title} onChange={(e) => set(i, { title: e.target.value })} />
              </Field>
              <Field label="Why" hint="What people said that led here." error={tried && !d.why.trim() ? 'This is needed.' : undefined}>
                <textarea className={inputClass} rows={3} value={d.why} onChange={(e) => set(i, { why: e.target.value })} />
              </Field>
              <Field label="The options that were considered" hint="One per line.">
                <textarea className={inputClass} rows={3} value={d.options} onChange={(e) => set(i, { options: e.target.value })} />
              </Field>
              <Field label="The disagreement that remains">
                <textarea className={inputClass} rows={2} value={d.dissent} onChange={(e) => set(i, { dissent: e.target.value })} />
              </Field>
              <Field label="Tests for “done”" hint="One per line, so that anyone who took part could check it." error={tried && lines(d.tests).length === 0 ? 'Write at least one test.' : undefined}>
                <textarea className={inputClass} rows={3} value={d.tests} onChange={(e) => set(i, { tests: e.target.value })} />
              </Field>
              <fieldset className="mb-2">
                <legend className="mb-1 font-bold">How it will be delivered</legend>
                {tried && !d.technology && !d.social && <p className="font-bold text-warn">Choose at least one.</p>}
                <label className="mr-6 inline-flex items-center gap-2">
                  <input type="checkbox" className="h-5 w-5" checked={d.technology} onChange={(e) => set(i, { technology: e.target.checked })} /> Technology
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" className="h-5 w-5" checked={d.social} onChange={(e) => set(i, { social: e.target.checked })} /> A social arrangement
                </label>
              </fieldset>
            </fieldset>
          ))}
          <Button type="submit" disabled={busy}>
            Write up the decisions
          </Button>
        </form>
      )}
      <Result error={error} done={ok} />
    </Job>
  );
}

function FollowThroughJobs({ slug }: { slug: string }) {
  const [records, setRecords] = useState<DecisionRecord[]>();
  const [loadError, setLoadError] = useState<string>();
  const { busy, error, run } = useAction();
  const load = async () => {
    try {
      const list = await api.get<DecisionsResponse>(`/api/assemblies/${slug}/decisions`);
      const live = list.decisions.filter((d) => ['accepted', 'changed', 'in_progress'].includes(d.status));
      setRecords(await Promise.all(live.map((d) => api.get<DecisionRecord>(`/api/decisions/${d.id}`))));
    } catch (e) {
      setLoadError(messageOf(e));
    }
  };
  useEffect(() => void load(), [slug]);
  const toConfirm = (records ?? []).flatMap((r) => r.proposals.filter((p) => p.status === 'chosen' && !p.faithfulConfirmedAt).map((p) => ({ r, p })));
  const toCheck = (records ?? []).filter(checkable);
  return (
    <>
      <Job title="Confirm a plan is faithful" about="Before work starts, confirm the plan the host chose would deliver what was decided." count={records ? `${toConfirm.length} waiting` : undefined}>
        {loadError && <Result error={loadError} />}
        {records && toConfirm.length === 0 && <p>No chosen plan is waiting.</p>}
        <ul className="space-y-2">
          {toConfirm.map(({ r, p }) => (
            <li key={p.id} className="rounded-ui border border-line p-3">
              <p className="text-sm text-muted">Decision {r.decision.number}: {r.decision.title}</p>
              <p className="mb-2">
                {p.summary} <span className="text-muted">({p.proposerName})</span>
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" disabled={busy} onClick={() => void run(() => api.patch(`/api/proposals/${p.id}`, { faithful: true })).then((x) => {
                      if (x !== undefined) void load();
                    })}>
                  Confirm it is faithful
                </Button>
                <Link to={`/a/${slug}/decisions/${r.decision.id}`} className="self-center">
                  Read the plan
                </Link>
              </div>
            </li>
          ))}
        </ul>
        <Result error={error} />
      </Job>
      <Job title="Record a check" about="Test what was delivered against each numbered test. Only a check can say a decision was delivered." count={records ? `${toCheck.length} ready` : undefined}>
        {records && toCheck.length === 0 && <p>No decision is ready to be checked.</p>}
        <ul className="space-y-2">
          {toCheck.map((r) => (
            <li key={r.decision.id}>
              <span className="mb-1 block">{r.decision.title}</span>
              <Button variant="secondary" to={`/a/${slug}/decisions/${r.decision.id}`}>
                Check decision {r.decision.number}
              </Button>
            </li>
          ))}
        </ul>
      </Job>
    </>
  );
}

/** The steward's jobs for one assembly, each calling the endpoint section 7 names. */
export function StewardJobs({ slug, capacity }: { slug: string; capacity: number }) {
  return (
    <ul>
      <ActionJob
        title="Update the picture"
        about="Group new approved points into themes and describe them."
        label="Update the picture"
        path={`/api/assemblies/${slug}/picture/update`}
        done="The picture is updated."
      />
      <ActionJob
        title="Confirm the picture"
        about="Confirm the picture is faithful to what people said. Read it first."
        label="Confirm the picture"
        path={`/api/assemblies/${slug}/picture/confirm`}
        done="The picture is confirmed."
      />
      <ReportsJob slug={slug} />
      <ObjectionsJob slug={slug} />
      <ActionJob
        title="Draft statements"
        about="Draft statements from the picture for people to react to. Each rests on points people approved."
        label="Draft statements"
        path={`/api/assemblies/${slug}/statements/draft`}
        done="Statements are drafted. Read them on the statements page."
      />
      <RoomJob slug={slug} />
      <DecideJob slug={slug} capacity={capacity} />
      <FollowThroughJobs slug={slug} />
    </ul>
  );
}
