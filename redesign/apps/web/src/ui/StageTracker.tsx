import { ASSEMBLY_STAGES, stageIndex, type AssemblyStage, type StageChecklist } from '@unite/shared';

/**
 * The ten stages of an assembly, with the current one expanded: what happens in it and, when a
 * checklist is given, the conditions for moving on and whether each is met.
 */
export function StageTracker({ stage, checklist }: { stage: AssemblyStage; checklist?: StageChecklist }) {
  const current = stageIndex(stage);
  return (
    <ol className="space-y-0" aria-label="Stages of this assembly">
      {ASSEMBLY_STAGES.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'now' : 'later';
        return (
          <li key={s.key} aria-current={state === 'now' ? 'step' : undefined} className="relative flex gap-3">
            <span aria-hidden="true" className="flex w-6 shrink-0 flex-col items-center">
              <span
                className={`mt-1 block h-4 w-4 rounded-full border-2 ${
                  state === 'done' ? 'border-ink bg-ink' : state === 'now' ? 'border-accent bg-accent' : 'border-muted bg-white'
                }`}
              />
              {i < ASSEMBLY_STAGES.length - 1 && <span className={`mt-1 block w-px flex-1 ${i < current ? 'bg-ink' : 'bg-line'}`} />}
            </span>
            <div className={`min-w-0 flex-1 ${i < ASSEMBLY_STAGES.length - 1 ? 'pb-3' : ''}`}>
              <p className={state === 'now' ? 'font-bold' : state === 'done' ? 'text-ink' : 'text-muted'}>
                {s.title}
                <span className="sr-only">{state === 'done' ? ' (done)' : state === 'now' ? ' (now)' : ' (later)'}</span>
                {state === 'now' && <span className="ml-2 text-sm font-bold text-accent">Now</span>}
              </p>
              {state === 'now' && (
                <div className="mt-1 mb-2">
                  <p>{s.description}</p>
                  {checklist && checklist.next && checklist.items.length > 0 && (
                    <div className="mt-2">
                      <p className="font-bold">To move on to {ASSEMBLY_STAGES[current + 1]!.title.toLowerCase()}:</p>
                      <ul className="mt-1 space-y-1">
                        {checklist.items.map((item) => (
                          <li key={item.key} className="flex gap-2">
                            <span aria-hidden="true" className={item.met ? 'text-agree font-bold' : 'text-muted font-bold'}>
                              {item.met ? '✓' : '○'}
                            </span>
                            <span>
                              {item.text}
                              <span className="sr-only">{item.met ? ': done' : ': not yet'}</span>
                              {item.detail && <span className="block text-sm text-muted">{item.detail}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
