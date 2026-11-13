import type { PromptsResponse } from '@unite/shared';
import { useApi } from '../../lib/api';
import { Banner } from '../../ui/Banner';
import { Layout } from '../../ui/Layout';

/** Readable names for the published prompts. */
function title(name: string): string {
  return name
    .replace(/_SYSTEM$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

export default function Prompts() {
  const { data, error } = useApi<PromptsResponse>('/api/how/prompts');
  return (
    <Layout title="The prompts">
      <p className="mb-4">
        This is everything the AI is told, word for word. The interviewer, the summaries and the room facilitator all work from these texts.
      </p>
      {error && <Banner tone="warn">{error.message}</Banner>}
      {data && (
        <>
          <dl className="mb-6 space-y-1">
            <div>
              <dt className="inline font-bold">Prompt version: </dt>
              <dd className="inline">{data.promptVersion}</dd>
            </div>
            <div>
              <dt className="inline font-bold">Model: </dt>
              <dd className="inline">{data.model}</dd>
            </div>
            <div>
              <dt className="inline font-bold">Right now: </dt>
              <dd className="inline">
                {data.mode === 'claude' ? 'The AI interviewer is switched on.' : 'The AI interviewer is not switched on, so conversations use fixed questions.'}
              </dd>
            </div>
          </dl>
          <ul className="space-y-3">
            {data.prompts.map((p) => (
              <li key={p.name}>
                <details className="rounded-ui border border-line">
                  <summary className="cursor-pointer px-4 py-3 font-bold text-accent">{title(p.name)}</summary>
                  <pre className="overflow-x-auto px-4 pb-4 font-sans text-base whitespace-pre-wrap break-words">{p.text}</pre>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </Layout>
  );
}
