import { INTERVIEW_STAGES } from '@unite/shared';

const STEPS = INTERVIEW_STAGES.filter((s) => s.aiTurn);

/** The eight conversation stages as words, the current one marked. On phones it collapses to one line. */
export function StageSteps({ stage }: { stage: number }) {
  const current = STEPS.find((s) => s.n === stage);
  return (
    <nav aria-label="Steps of the conversation" className="mb-4">
      {current && (
        <p className="text-sm sm:hidden">
          <span className="font-bold">
            Step {current.n} of {STEPS.length}:
          </span>{' '}
          {current.title}
        </p>
      )}
      <ol className="hidden flex-wrap gap-x-1 gap-y-1 text-sm sm:flex">
        {STEPS.map((s, i) => {
          const state = s.n < stage ? 'done' : s.n === stage ? 'now' : 'later';
          return (
            <li key={s.key} aria-current={state === 'now' ? 'step' : undefined} className="flex items-center gap-1">
              <span
                className={
                  state === 'now'
                    ? 'rounded-ui border border-accent px-1.5 font-bold text-accent'
                    : state === 'done'
                      ? 'px-1.5 text-ink'
                      : 'px-1.5 text-muted'
                }
              >
                {s.title}
                <span className="sr-only">{state === 'done' ? ' (done)' : state === 'now' ? ' (now)' : ''}</span>
              </span>
              {i < STEPS.length - 1 && (
                <span aria-hidden="true" className="text-muted">
                  ·
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
