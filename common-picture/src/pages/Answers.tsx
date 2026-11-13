import { ASKS, CHECK_PANEL, HOSTS, REGISTER, TODAY, daysBetween } from '../data/content';
import { PageHead } from '../ui/Layout';
import { ExampleTag, Words } from '../ui/Words';

const fmt = (iso: string) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const host = (id: string) => HOSTS.find((h) => h.id === id)!;
const ask = (id: string) => ASKS.find((a) => a.id === id)!;

export function Answers() {
  const todayIso = TODAY.toISOString().slice(0, 10);
  return (
    <div className="wrap">
      <PageHead eyebrow="Answer · Check" title="Pledges and the register">
        The picture changes no law by being published. It asks institutions one thing: pledge to answer it in public, by a date,
        within their own remit. Every answer is recorded, and people drawn by lot check what was done.
      </PageHead>
      <p className="notice">
        <strong>Every host on this page is an invented example host.</strong> No real government, council, fund, UN body or
        assembly has pledged to answer, endorsed or taken part. <ExampleTag />
      </p>

      <section className="section" aria-labelledby="hosts">
        <h2 id="hosts">Hosts who have pledged to answer</h2>
        <div className="grid three">
          {HOSTS.map((h) => (
            <article key={h.id} className="card" aria-labelledby={`h-${h.id}`}>
              <span className="example-tag">Invented example host</span>
              <h3 id={`h-${h.id}`} style={{ marginTop: '0.5rem' }}>
                {h.name}
              </h3>
              <p className="small muted">{h.where}</p>
              <dl className="small" style={{ margin: 0 }}>
                <dt>
                  <strong>Pledge</strong>
                </dt>
                <dd style={{ margin: '0 0 0.4rem' }}>
                  {h.pledge}: a reasoned public answer to every priority within its remit, by {fmt(h.answerBy)}.
                </dd>
                <dt>
                  <strong>Within its remit</strong>
                </dt>
                <dd style={{ margin: '0 0 0.4rem' }}>{h.remit}</dd>
                <dt>
                  <strong>Pledged</strong>
                </dt>
                <dd style={{ margin: 0 }}>{fmt(h.pledged)}</dd>
              </dl>
            </article>
          ))}
        </div>
        <p className="small muted">
          A pledge may be strengthened quietly but can only be weakened in public, with reasons. Three strengths exist: to answer,
          to measure, and to align a named budget, rule or mandate to named measures.
        </p>
      </section>

      <section className="section" aria-labelledby="asks">
        <h2 id="asks">Asks, addressed to kinds of host</h2>
        <p className="muted">
          Each ask comes with signs an ordinary person could check. In the full design, asks are written by people drawn by lot
          after working through the picture. Here they are invented examples, written to show the form; no assembly has met or
          decided anything.
        </p>
        <div className="grid two">
          {ASKS.map((a) => (
            <article key={a.id} className="card" aria-labelledby={`a-${a.id}`}>
              <p className="eyebrow">To: {a.to}</p>
              <h3 id={`a-${a.id}`}>{a.ask}</h3>
              <p className="small" style={{ marginBottom: '0.3rem' }}>
                <strong>Signs an ordinary person could check</strong>
              </p>
              <ul className="small" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {a.signs.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="register">
        <h2 id="register">The register</h2>
        <p className="muted">
          Every answer, by host: accepted, changed, delayed or refused, with reasons. A missing answer is shown as late, with the
          number of days.
        </p>
        <div className="table-wrap">
          <table className="register">
            <caption className="sr-only">Register of answers (invented examples)</caption>
            <thead>
              <tr>
                <th scope="col">Host</th>
                <th scope="col">Ask</th>
                <th scope="col">Answer</th>
                <th scope="col">Reasons given</th>
                <th scope="col">Check</th>
              </tr>
            </thead>
            <tbody>
              {REGISTER.map((r) => {
                const late = r.status === 'Late' ? daysBetween(r.due, todayIso) : 0;
                return (
                  <tr key={r.id}>
                    <td data-label="Host">
                      {host(r.host).name}
                      <br />
                      <span className="small muted">invented example host</span>
                    </td>
                    <td data-label="Ask">{ask(r.ask).ask}</td>
                    <td data-label="Answer">
                      <span className={`status ${r.status}`}>{r.status === 'Late' ? `Late · ${late} days` : r.status}</span>
                      <br />
                      <span className="small muted">{r.answered ? `Answered ${fmt(r.answered)}` : `Due ${fmt(r.due)}`}</span>
                    </td>
                    <td data-label="Reasons given">{r.answer}</td>
                    <td data-label="Check">
                      <strong>{r.check.verdict}</strong>
                      <br />
                      <span className="small muted">{r.check.note}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section card" aria-labelledby="panel">
        <p className="eyebrow">Check panel · drawn by lot</p>
        <h2 id="panel">{CHECK_PANEL.title}</h2>
        <p className="muted">
          {CHECK_PANEL.drawn} A host cannot mark its own work. The categories are fixed in advance:{' '}
          {CHECK_PANEL.categories.join(', ')}.
        </p>
        <p style={{ fontSize: '1.15rem' }}>
          Verdict: <strong>{CHECK_PANEL.verdict}</strong> ({CHECK_PANEL.tally}) <ExampleTag />
        </p>
        <div className="grid two">
          {CHECK_PANEL.members.map((m) => (
            <article key={m.seat} className="card" style={{ background: 'var(--paper)' }}>
              <div className="msg-head">
                <strong>{m.seat}</strong>
                <span>{m.verdict}</span>
              </div>
              <Words w={m.words} />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
