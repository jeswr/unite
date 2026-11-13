import { personCount } from './PersonCount';

export interface SourceQuote {
  id: string;
  text: string;
  /** Shown as "you said this" on my own points. */
  mine?: boolean;
  name?: string;
}

/** "Sources": opens the quotes and the number of people behind a sentence (rule 3). */
export function Sources({ people, quotes }: { people: number; quotes: SourceQuote[] }) {
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-accent underline underline-offset-2">Sources: {personCount(people)}</summary>
      {quotes.length === 0 ? (
        <p className="mt-2 text-muted">The people behind this chose to be counted without their words shown.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {quotes.map((q) => (
            <li key={q.id} className="border-l-2 border-line pl-3">
              <q>{q.text}</q>
              {(q.mine || q.name) && <span className="block text-sm text-muted">{q.mine ? 'You said this' : q.name}</span>}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
