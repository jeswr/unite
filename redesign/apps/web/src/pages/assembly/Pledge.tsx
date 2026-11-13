import { useParams } from 'react-router';
import { formatDate, levelName } from '@unite/shared';
import { useAssembly } from '../../lib/useAssembly';
import { Banner } from '../../ui/Banner';
import { Layout } from '../../ui/Layout';
import { checkBodyWords, draftNote, replyWords, ruleParagraph } from './pledgeWords';

export default function PledgePage() {
  const { slug } = useParams();
  const { data: view, error } = useAssembly(slug);
  if (!view)
    return (
      <Layout title={error ? 'This pledge could not be loaded' : 'Loading the pledge…'}>
        <p>{error ? error.message : 'Loading…'}</p>
      </Layout>
    );
  const a = view.assembly;
  const p = a.pledge;
  const draft = draftNote(a);
  return (
    <Layout title="The pledge" assembly={a} kicker={a.question}>
      {!p ? (
        <p>{a.isOpenListening ? 'Open listening has no host and no pledge. Nobody has promised to act on it, which is why it decides nothing.' : 'This assembly has no pledge yet, so it cannot open.'}</p>
      ) : (
        <>
          {draft && <Banner className="mb-5">{draft}</Banner>}
          <p className="mb-6">
            {a.hostName} has made this written commitment. Nothing is asked of people unless someone has promised to answer.
          </p>
          <section className="mb-6">
            <h2 className="mb-1">What is set aside</h2>
            <p>{p.setAside}</p>
          </section>
          <section className="mb-6">
            <h2 className="mb-1">What the host can act on</h2>
            <p>{p.remit}</p>
          </section>
          <section className="mb-6">
            <h2 className="mb-1">What is off the table, and why</h2>
            <p>{p.offTable}</p>
          </section>
          <section className="mb-6">
            <h2 className="mb-1">How it is decided: {levelName(p.decisionLevel)}</h2>
            <p>{ruleParagraph(p)}</p>
          </section>
          <section className="mb-6">
            <h2 className="mb-1">When the host will answer</h2>
            <p>{replyWords(p)} Each answer says accepted, changed, delayed or refused, with reasons. A missing answer is shown as late.</p>
          </section>
          <section className="mb-6">
            <h2 className="mb-1">Who checks it was done</h2>
            <p>
              {checkBodyWords(p)} The host cannot mark its own work as done. Each decision is reviewed {p.reviewAfterDays} days after it is
              made.
            </p>
          </section>
          {p.publishedAt && (
            <p className="text-muted">
              Published on {formatDate(p.publishedAt)}.
              {p.challengeEndsAt && ` It could be challenged until ${formatDate(p.challengeEndsAt)}.`}
            </p>
          )}
        </>
      )}
    </Layout>
  );
}
