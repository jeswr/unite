import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useApi } from '../../lib/api';
import { useAssembly } from '../../lib/useAssembly';
import { useLive } from '../../lib/useLive';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';
import { Tag } from '../../ui/Tag';
import { NotHeard } from '../picture/parts';
import { ANSWER_WORDS, AnswerBars, AnswerButtons, groupOf, SETTLED, STATUS_TONE, STATUS_WORDS } from './parts';
import type { StatementsResponse, StatementSummary } from './types';

const GROUPS: { key: ReturnType<typeof groupOf>; title: string; empty: string }[] = [
  { key: 'common', title: 'Common ground', empty: 'No statement has reached common ground yet.' },
  { key: 'differ', title: 'Where we differ', empty: 'No statement shows people split yet.' },
  { key: 'notEnough', title: 'Not enough voices yet', empty: 'None.' },
];

/** The statements I have not answered, one at a time: answer, see how others answered, move on. */
function OneAtATime({ slug, queue, onAnswered }: { slug: string; queue: StatementSummary[]; onAnswered: () => void }) {
  const [answered, setAnswered] = useState<StatementSummary | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const statementHeading = useRef<HTMLParagraphElement>(null);
  const current = queue.find((s) => !done.has(s.id));
  useEffect(() => {
    if (answered) resultHeading.current?.focus();
  }, [answered]);

  if (answered)
    return (
      <Card as="section" className="mb-10">
        <h2 ref={resultHeading} tabIndex={-1} className="mb-2">
          How others answered
        </h2>
        <p className="mb-1 text-lg">“{answered.text}”</p>
        <p className="mb-4 text-muted">You answered: {answered.myReaction ? ANSWER_WORDS[answered.myReaction] : ''}</p>
        <div aria-live="polite">{answered.results && <AnswerBars results={answered.results} />}</div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Button
            onClick={() => {
              setAnswered(null);
              requestAnimationFrame(() => statementHeading.current?.focus());
            }}
          >
            {current ? 'Next statement' : 'Done'}
          </Button>
          <Link to={`/a/${slug}/statements/${answered.id}`}>Reasons and details</Link>
        </div>
      </Card>
    );
  if (!current)
    return (
      <Card as="section" className="mb-10">
        <h2 className="mb-2">You have answered every statement</h2>
        <p>Thank you. New statements and new wordings will appear here for you to answer.</p>
      </Card>
    );
  const left = queue.filter((s) => !done.has(s.id)).length;
  return (
    <Card as="section" className="mb-10">
      <h2 className="mb-1 text-base font-normal text-muted">
        {left === 1 ? '1 statement for you to answer' : `${left} statements for you to answer`}
      </h2>
      <p ref={statementHeading} tabIndex={-1} className="my-4 text-2xl leading-snug font-bold">
        {current.text}
      </p>
      <AnswerButtons
        key={current.id}
        statement={current}
        onAnswered={(s) => {
          setDone((d) => new Set(d).add(s.id));
          setAnswered(s);
          onAnswered();
        }}
      />
    </Card>
  );
}

function StatementItem({ s, slug }: { s: StatementSummary; slug: string }) {
  return (
    <Card as="li" className="list-none">
      <p className="mb-2 font-bold">
        <Link to={`/a/${slug}/statements/${s.id}`}>{s.text}</Link>
      </p>
      <p className="mb-2 flex flex-wrap gap-2">
        <Tag tone={STATUS_TONE[s.status]}>{STATUS_WORDS[s.status]}</Tag>
        {s.version > 1 && <Tag>Version {s.version}</Tag>}
        {s.mine && <Tag tone="accent">Your wording</Tag>}
      </p>
      {s.results ? (
        <>
          {s.myReaction && <p className="mb-2 text-muted">You answered: {ANSWER_WORDS[s.myReaction]}</p>}
          <AnswerBars results={s.results} />
        </>
      ) : (
        <p className="text-muted">Answer to see how others answered.</p>
      )}
    </Card>
  );
}

/** /a/:slug/statements: answer one at a time, then everything in three plain groups. */
export default function Statements() {
  const { slug = '' } = useParams();
  const version = useLive(slug);
  const { data: view, reload: reloadView } = useAssembly(slug, version);
  const { data, error, reload } = useApi<StatementsResponse>(`/api/assemblies/${encodeURIComponent(slug)}/statements`, version);
  // The queue is fixed when first shown, so a live refresh never swaps the statement in front of me.
  const [queueIds, setQueueIds] = useState<string[]>();
  useEffect(() => {
    if (!data) return;
    const open = data.statements.filter((s) => !s.myReaction && !s.mine && !SETTLED.has(s.status)).map((s) => s.id);
    setQueueIds((q) => (q ? [...q, ...open.filter((id) => !q.includes(id))] : open));
  }, [data]);
  const assembly = view?.assembly;
  const layout = (body: ReactNode) => (
    <Layout title="Statements" assembly={assembly} kicker={assembly?.question}>
      {body}
    </Layout>
  );

  if (error?.code === 'not_heard')
    return layout(
      <NotHeard
        slug={slug}
        isExample={assembly?.isExample}
        what="the statements drafted from what everyone said"
        onLookedAround={() => {
          reloadView();
          reload();
        }}
      />,
    );
  if (error && !data) return layout(<p>{error.message}</p>);
  if (!data || !queueIds) return layout(<p aria-live="polite">Loading the statements…</p>);
  if (data.statements.length === 0)
    return layout(
      <EmptyState title="No statements yet">
        <p>
          Statements are drafted from <Link to={`/a/${slug}/picture`}>the picture</Link> once enough people have been heard. Each one rests on points people
          approved. Come back soon.
        </p>
      </EmptyState>,
    );

  const byId = new Map(data.statements.map((s) => [s.id, s]));
  const queue = queueIds.map((id) => byId.get(id)).filter((s): s is StatementSummary => !!s && !s.myReaction);
  return layout(
    <>
      <p className="mb-6 text-muted">
        Each statement was drafted from what people said. Agree, disagree, say you are not sure, or say it better. You see how others answered only after you
        answer.
      </p>
      <OneAtATime slug={slug} queue={queue} onAnswered={reload} />
      {GROUPS.map((g) => {
        const items = data.statements.filter((s) => groupOf(s.status) === g.key);
        return (
          <section key={g.key} aria-labelledby={`group-${g.key}`} className="mt-8">
            <h2 id={`group-${g.key}`} className="mb-3">
              {g.title}
            </h2>
            {items.length === 0 ? (
              <p className="text-muted">{g.empty}</p>
            ) : (
              <ul className="space-y-4">
                {items.map((s) => (
                  <StatementItem key={s.id} s={s} slug={slug} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>,
  );
}
