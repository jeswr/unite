import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { formatDate, levelName, stageIndex, type AssemblyView } from '@unite/shared';
import { api, ApiError } from '../../lib/api';
import { useAssembly } from '../../lib/useAssembly';
import { useLive } from '../../lib/useLive';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Layout } from '../../ui/Layout';
import { personCount } from '../../ui/PersonCount';
import { StageTracker } from '../../ui/StageTracker';
import { draftNote, replyWords } from './pledgeWords';

interface Action {
  label: string;
  to?: string;
  lookAround?: boolean;
}

/** The actions that fit me now, most fitting first, from the stage, rule 1 and my membership. */
export function actionsFor(view: AssemblyView): { note?: string; actions: Action[] } {
  const { assembly: a, heard, membership } = view;
  const base = `/a/${a.slug}`;
  const at = stageIndex(a.stage);
  const after = (s: Parameters<typeof stageIndex>[0]) => at >= stageIndex(s);
  if (a.stage === 'proposed')
    return { note: 'This assembly has not opened yet. The host is still preparing the question and the pledge.', actions: [{ label: 'Read the draft pledge', to: `${base}/pledge` }] };
  if (a.stage === 'pledged')
    return {
      note: a.pledge?.challengeEndsAt
        ? `The pledge can be challenged until ${formatDate(a.pledge.challengeEndsAt)}. Conversations open after that.`
        : 'The pledge has been published. Conversations open soon.',
      actions: [{ label: 'Read the pledge', to: `${base}/pledge` }],
    };

  const actions: Action[] = [];
  const canTalk = a.isOpenListening || (after('listening') && !after('answered'));
  const lookedAround = !!membership?.lookedAroundFirst && view.role === 'participant';
  if (after('answered')) actions.push({ label: 'Read the decisions and answers', to: `${base}/decisions` });
  if (!heard) {
    const mine = view.myConversation;
    if (canTalk && mine?.status === 'active') actions.push({ label: 'Carry on my conversation', to: `/talk/${mine.id}` });
    else if (canTalk && mine?.status === 'reviewing') actions.push({ label: 'Check what I said', to: `/talk/${mine.id}/review` });
    else if (canTalk) actions.push({ label: 'Start my conversation', to: `${base}/talk` });
    if (a.isExample) actions.push({ label: 'Look around the example first', lookAround: true });
  } else {
    if (a.stage === 'deciding') actions.push({ label: 'Choose my priorities', to: `${base}/priorities` });
    if (a.stage === 'deliberating') actions.push({ label: 'React to statements', to: `${base}/statements` }, { label: 'Join my room', to: `${base}/rooms` });
    actions.push({ label: 'See the picture', to: `${base}/picture` });
    if (after('deciding')) actions.push({ label: 'Statements', to: `${base}/statements` }, { label: 'Rooms', to: `${base}/rooms` });
    if (lookedAround && canTalk) actions.push({ label: 'Start my conversation', to: `${base}/talk` });
  }

  let note: string | undefined;
  if (lookedAround) note = 'You chose to look around the example first.';
  else if (!heard && !canTalk) note = 'The picture and statements are open to the people who took part.';
  return { note, actions };
}

export default function AssemblyPage() {
  const { slug } = useParams();
  const version = useLive(slug);
  const { data: view, error, reload } = useAssembly(slug, version);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [params, setParams] = useSearchParams();
  const invite = params.get('invite');
  const [invited, setInvited] = useState(false);

  // An invitation link carries a code. Use it once, then take it out of the address.
  useEffect(() => {
    if (!invite || !slug) return;
    api
      .post(`/api/assemblies/${slug}/join`, { inviteCode: invite })
      .then(
        () => {
          setInvited(true);
          reload();
        },
        (e: unknown) => setActionError(e instanceof ApiError ? e.message : 'That invitation could not be used. Please try the link again.'),
      )
      .finally(() => setParams({}, { replace: true }));
  }, [invite, slug]);

  if (error && !view)
    return (
      <Layout title={error.status === 404 ? 'There is no assembly here' : 'This assembly could not be loaded'}>
        <p>{error.message}</p>
      </Layout>
    );
  if (!view)
    return (
      <Layout title="Loading the assembly…">
        <p aria-live="polite">Loading…</p>
      </Layout>
    );

  const a = view.assembly;
  const p = a.pledge;
  const { note, actions } = actionsFor(view);
  const draft = draftNote(a);

  const lookAround = async () => {
    setBusy(true);
    setActionError(undefined);
    try {
      await api.post(`/api/assemblies/${a.slug}/join`, { lookAroundFirst: true });
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title={a.question} assembly={a} kicker={a.isOpenListening ? 'Open listening' : `Hosted by ${a.hostName}`}>
      {a.summary && <p className="mb-6">{a.summary}</p>}

      <Card as="section" className="mb-8">
        <h2 className="mb-2">What you can do now</h2>
        {invited && <Banner className="mb-3">Your invitation has been accepted. What you say here will be counted.</Banner>}
        {note && <p className="mb-3">{note}</p>}
        {actionError && <Banner tone="warn" className="mb-3">{actionError}</Banner>}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {actions.map((act, i) =>
            act.lookAround ? (
              <Button key={act.label} variant={i === 0 ? 'primary' : 'secondary'} onClick={() => void lookAround()} disabled={busy}>
                {act.label}
              </Button>
            ) : (
              <Button key={act.label} to={act.to!} variant={i === 0 ? 'primary' : 'secondary'}>
                {act.label}
              </Button>
            ),
          )}
        </div>
        {view.counts.heard > 0 && <p className="mt-3 text-muted">{personCount(view.counts.heard)} heard so far.</p>}
      </Card>

      {p && (
        <section className="mb-8" aria-labelledby="pledge-brief">
          <h2 id="pledge-brief" className="mb-2">
            The pledge in brief
          </h2>
          {draft && <Banner className="mb-3">{draft}</Banner>}
          <dl className="space-y-2">
            <div>
              <dt className="font-bold">Set aside</dt>
              <dd>{p.setAside}</dd>
            </div>
            <div>
              <dt className="font-bold">How it is decided</dt>
              <dd>
                {levelName(p.decisionLevel)}: at least {Math.round(p.groupThreshold * 100)}% must agree on each side of how people answered, not only overall.
              </dd>
            </div>
            <div>
              <dt className="font-bold">Answer</dt>
              <dd>{replyWords(p)}</dd>
            </div>
          </dl>
          <p className="mt-3">
            <Link to={`/a/${a.slug}/pledge`} className="font-bold">
              Read the full pledge
            </Link>
          </p>
        </section>
      )}
      {!p && a.isOpenListening && (
        <section className="mb-8">
          <h2 className="mb-2">What open listening promises</h2>
          <p>Your words are counted and shown faithfully, and you are told when an assembly opens on something you raised. Nobody has promised to act on open listening itself.</p>
        </section>
      )}

      <section aria-labelledby="stages">
        <h2 id="stages" className="mb-3">
          Where this assembly is
        </h2>
        <StageTracker stage={a.stage} checklist={view.checklist} />
      </section>
    </Layout>
  );
}
