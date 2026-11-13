import { useState } from 'react';
import { GOOD_DAYS, type Matter } from '../data/content';
import { LAYER } from '../data/layers';
import { PageHead } from '../ui/Layout';
import { ExampleTag, Words } from '../ui/Words';

const MATTERS: Matter[] = ['Time', 'Movement', 'Care', 'Safety', 'Work', 'Home'];

export function Days() {
  const [filter, setFilter] = useState<Matter | 'All'>('All');
  const shown = MATTERS.filter((m) => filter === 'All' || m === filter);
  return (
    <div className="wrap">
      <PageHead eyebrow="After your conversation" title="Good days from elsewhere">
        Short, ordinary good days that people described, grouped by what matters in them. No names, no profiles, no rankings, and
        nothing to like or share.
      </PageHead>
      <p className="notice">
        Every day on this page is an invented example written to show the form. <ExampleTag />
      </p>
      <div className="btn-row" role="group" aria-label="Show days about" style={{ margin: '1rem 0' }}>
        <div className="seg">
          {(['All', ...MATTERS] as const).map((m) => (
            <button key={m} type="button" aria-pressed={filter === m} onClick={() => setFilter(m)}>
              {m}
            </button>
          ))}
        </div>
      </div>
      {shown.map((m) => (
        <section key={m} className="section" aria-labelledby={`m-${m}`}>
          <h2 id={`m-${m}`}>{m}</h2>
          <div className="grid two">
            {GOOD_DAYS.filter((d) => d.matter === m).map((d) => (
              <figure key={d.id} className="card" style={{ margin: 0 }}>
                <Words w={d.words} />
                <figcaption className="who">A good ordinary day · {LAYER[d.layer].kind === 'circle' ? 'the Quechua-speaking circle' : LAYER[d.layer].shortName}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
