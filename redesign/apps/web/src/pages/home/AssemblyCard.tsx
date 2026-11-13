import { Link } from 'react-router';
import { formatDate, KIND_WORDS, stageInfo, type AssemblySummary } from '@unite/shared';
import { Tag } from '../../ui/Tag';
import { personCount } from '../../ui/PersonCount';

/** What happens to what you say in an assembly, in one or two plain sentences. */
export function whatHappens(a: Pick<AssemblySummary, 'kind' | 'replyBy' | 'isOpenListening'>): string {
  const promise = KIND_WORDS[a.kind].promise;
  if (a.isOpenListening || !a.replyBy) return promise;
  return `${promise} The reply date is ${formatDate(a.replyBy)}.`;
}

export function AssemblyCard({ a, headingLevel = 3 }: { a: AssemblySummary; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <li className="rounded-ui border border-line p-4">
      <p className="mb-1 flex flex-wrap items-center gap-2 text-sm">
        <Tag tone="accent">{stageInfo(a.stage).title}</Tag>
        {a.isExample && <Tag>Example</Tag>}
      </p>
      <H className="mb-1 text-[1.05rem]">
        <Link to={`/a/${a.slug}`}>{a.question}</Link>
      </H>
      <p className="text-muted">{a.isOpenListening ? 'Open listening. No host.' : `Hosted by ${a.hostName}`}</p>
      <p className="mt-2">
        <span className="font-bold">What happens to what you say: </span>
        {whatHappens(a)}
      </p>
      {a.heard > 0 && <p className="mt-1 text-sm text-muted">{personCount(a.heard)} heard so far</p>}
    </li>
  );
}
