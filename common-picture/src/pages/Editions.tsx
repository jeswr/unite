import { EDITION0, EDITION_CHANGES, HISTORIES, PILOT } from '../data/content';
import { finding, pct } from '../data/picture';
import { PageHead } from '../ui/Layout';
import { ExampleTag } from '../ui/Words';

/** Edition 0 support is read from the live picture where a statement has a theme, so the numbers agree. */
export function edition0Support(h: (typeof HISTORIES)[number]): number | null {
  return h.theme ? pct(finding('world', h.theme).people.drawn) : h.edition0;
}

export function Editions() {
  return (
    <div className="wrap narrow">
      <PageHead eyebrow="Editions" title="Each statement carries its history">
        Listening never closes. Every two years an edition is published. Each statement shows when it entered, how its wording
        changed, how support moved, and whether it was retired. Old editions stay public.
      </PageHead>
      <p className="notice">
        Compared here: <strong>{EDITION0}</strong> against a <strong>{PILOT.toLowerCase()}</strong> that did not happen. Both are
        example data. <ExampleTag />
      </p>

      <section className="section" aria-labelledby="changed">
        <h2 id="changed">What changed since the pilot, and why</h2>
        <ul>
          {EDITION_CHANGES.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="histories">
        <h2 id="histories">Statement histories</h2>
        <div className="table-wrap" style={{ marginBottom: '1.2rem' }}>
          <table>
            <caption className="sr-only">Support by edition, share of people in the drawn sample</caption>
            <thead>
              <tr>
                <th scope="col">Statement now</th>
                <th scope="col">Pilot</th>
                <th scope="col">Edition 0</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {HISTORIES.map((h) => {
                const e0 = edition0Support(h);
                return (
                  <tr key={h.id}>
                    <td>{h.now}</td>
                    <td>{h.pilot === null ? '—' : `${h.pilot}%`}</td>
                    <td>{e0 === null ? '—' : `${e0}%`}</td>
                    <td>{h.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid">
          {HISTORIES.map((h) => (
            <article key={h.id} className="card" aria-labelledby={`hist-${h.id}`}>
              <h3 id={`hist-${h.id}`}>{h.now}</h3>
              <ol style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {h.events.map((e) => (
                  <li key={e.edition + e.what}>
                    <strong>{e.edition}.</strong> {e.what}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
