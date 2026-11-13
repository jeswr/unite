import { Link } from 'react-router';
import type { EvidenceCard } from '@unite/shared';
import type { ApiError } from '../../lib/api';
import { Card } from '../../ui/Card';
import type { AnswerTotals, RoomOutcome } from '@unite/shared';

const CONFIDENCE: Record<EvidenceCard['confidence'], string> = {
  low: 'The expert is not very sure of this.',
  medium: 'The expert is fairly sure of this.',
  high: 'The expert is very sure of this.',
};

/** One evidence card: the question, the answer, sources as links, confidence in words, what is disputed, who answered. */
export function EvidenceCardView({ card, headingLevel = 3 }: { card: EvidenceCard; headingLevel?: 3 | 4 }) {
  const H = headingLevel === 3 ? 'h3' : 'h4';
  return (
    <Card as="article">
      <H className="mb-2">{card.question}</H>
      <p className="mb-2">{card.answer}</p>
      <p className="mb-2 text-muted">{CONFIDENCE[card.confidence]}</p>
      {card.disputed && (
        <p className="mb-2">
          <span className="font-bold">What other experts dispute: </span>
          {card.disputed}
        </p>
      )}
      {card.sources.length > 0 && (
        <ul className="mb-2 list-disc pl-5">
          {card.sources.map((s) => (
            <li key={s.url} className="break-words">
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted">
        Answered by {card.expertName}, {card.expertRole}
      </p>
    </Card>
  );
}

/** "3 agree, 2 disagree, 1 not sure": how the private final answers fell, in words. */
export function answersInWords(t: AnswerTotals): string {
  if (t.total === 0) return 'Nobody gave a final answer.';
  return `Final answers: ${t.agree} agree, ${t.disagree} disagree, ${t.unsure} not sure.`;
}

/** The members' own outcome: reasons for and against, any new wording, questions for experts. */
export function OutcomeView({ outcome, headingLevel = 3 }: { outcome: RoomOutcome; headingLevel?: 3 | 4 }) {
  const H = headingLevel === 3 ? 'h3' : 'h4';
  const none = !outcome.reasonsFor.length && !outcome.reasonsAgainst.length && !outcome.proposedWording && !outcome.questionsForExperts.length;
  if (none) return <p className="text-muted">The members did not add any reasons or wording.</p>;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <H className="mb-1 text-agree">Reasons for</H>
          {outcome.reasonsFor.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {outcome.reasonsFor.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">None given.</p>
          )}
        </div>
        <div>
          <H className="mb-1 text-disagree">Reasons against</H>
          {outcome.reasonsAgainst.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {outcome.reasonsAgainst.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">None given.</p>
          )}
        </div>
      </div>
      {outcome.proposedWording && (
        <div>
          <H className="mb-1">New wording</H>
          <blockquote className="border-l-4 border-accent pl-3">{outcome.proposedWording}</blockquote>
        </div>
      )}
      {outcome.questionsForExperts.length > 0 && (
        <div>
          <H className="mb-1">Questions for experts</H>
          <ul className="list-disc space-y-1 pl-5">
            {outcome.questionsForExperts.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** What a page behind rule 1 shows before the person has been heard, or when it could not load. */
export function NotHeardOrError({ error, slug, what }: { error: ApiError; slug: string; what: string }) {
  if (error.code === 'not_heard')
    return (
      <div className="space-y-3">
        <p>{error.message}</p>
        <p>
          {what} opens to you once you have been heard. That way what you say is your own, before you see what others said.
        </p>
        <p>
          <Link to={`/a/${slug}`} className="font-bold">
            Back to the assembly
          </Link>
        </p>
      </div>
    );
  return <p role="alert">{error.message}</p>;
}
