import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

/** Accessible tabs: arrow keys move between them. */
export function Tabs({ tabs, label, initial }: { tabs: Tab[]; label: string; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -2;
    if (next === -2) return;
    e.preventDefault();
    const j = (next + tabs.length) % tabs.length;
    setActive(tabs[j]!.id);
    refs.current[j]?.focus();
  };
  return (
    <div>
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-line">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${base}-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => setActive(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`-mb-px rounded-t-ui border px-3 py-2 min-h-11 font-bold ${active === t.id ? 'border-line border-b-white bg-white text-ink' : 'border-transparent text-accent underline underline-offset-2'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`${base}-panel-${t.id}`} aria-labelledby={`${base}-tab-${t.id}`} hidden={active !== t.id} className="pt-4">
          {active === t.id && t.content}
        </div>
      ))}
    </div>
  );
}
