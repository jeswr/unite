import { Link } from 'react-router';
import { LAYERS, TIER_LABEL } from '../data/layers';
import { CONVERSATIONS } from '../data/seed';
import { ExampleTag } from '../ui/Words';

const LOOP = [
  { name: 'Listen', text: 'A private conversation about a real day, in your own language, by web, phone, voice note or a listener.' },
  { name: 'See', text: 'A picture for every layer, with five parts. Nothing averaged into one utopia.' },
  { name: 'Talk', text: 'Slow rooms of people drawn by lot, across places, each reading the others in their own language.' },
  { name: 'Answer', text: 'Institutions that pledge to answer say in public what they accept, change, delay or refuse.' },
  { name: 'Check', text: 'People drawn by lot from earlier rooms check what was done, on a public register.' },
];

export function Home() {
  const people = CONVERSATIONS.length;
  return (
    <div className="wrap">
      <section className="hero" aria-labelledby="pitch">
        <p className="edition-badge">
          <span aria-hidden="true">●</span> Edition 0 · demonstration
        </p>
        <h1 id="pitch">
          A standing, public picture of the lives people want, built from private conversations in people’s own language and
          words, and tested by people drawn by lot.
        </h1>
        <p className="lede">
          Nobody is handed a list of goals to rank. Each person is asked about a real day, what mattered, what got in the way, and
          what an ordinary good day would look like a few years from now. The picture asks institutions for one thing:{' '}
          <strong>answer it in public.</strong>
        </p>
      </section>

      <section className="section" aria-label="Ways in">
        <div className="grid three">
          <Link to="/listen" className="card entry">
            <span className="eyebrow">About fifteen minutes</span>
            <h2 style={{ fontSize: '1.4rem' }}>Have the conversation</h2>
            <p className="muted">Try the interviewer in your language. It only asks; it never gives a view.</p>
            <span className="go">Start listening →</span>
          </Link>
          <Link to="/picture" className="card entry">
            <span className="eyebrow">Five places, one circle</span>
            <h2 style={{ fontSize: '1.4rem' }}>See the picture</h2>
            <p className="muted">What is said almost everywhere, said differently, said here, in tension, and not yet heard.</p>
            <span className="go">Open the picture →</span>
          </Link>
          <Link to="/answers" className="card entry">
            <span className="eyebrow">Invented example hosts</span>
            <h2 style={{ fontSize: '1.4rem' }}>See who has pledged to answer</h2>
            <p className="muted">Pledges, the public register of answers, and the people drawn by lot who check them.</p>
            <span className="go">See the register →</span>
          </Link>
        </div>
      </section>

      <section className="section" aria-labelledby="how">
        <h2 id="how">How it works</h2>
        <ol className="loop">
          {LOOP.map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong>
              <p className="muted small" style={{ marginTop: '0.3rem' }}>
                {s.text}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" aria-labelledby="where">
        <h2 id="where">
          In this demonstration <ExampleTag />
        </h2>
        <p className="muted">
          {people} invented conversations across five places and one circle. The places were chosen to test the method: one where
          most people take part by voice, and languages where an AI interviewer is less proven.
        </p>
        <ul className="grid three" style={{ listStyle: 'none', padding: 0 }}>
          {LAYERS.map((l) => (
            <li key={l.id} className="card">
              <h3 style={{ marginBottom: '0.2rem' }}>{l.kind === 'circle' ? 'A circle' : l.name}</h3>
              {l.kind === 'circle' && <p style={{ margin: 0 }}>{l.name}</p>}
              <p className="small muted" style={{ margin: '0.3rem 0' }}>
                <span lang={l.language.code}>{l.language.endonym}</span>
                {l.language.endonym !== l.language.name && <> · {l.language.name}</>} · tier:{' '}
                {TIER_LABEL[l.language.tier]} (illustrative)
              </p>
              <p className="small" style={{ margin: 0 }}>
                {l.size.open + l.size.drawn} example conversations. {l.routeNote}
              </p>
            </li>
          ))}
        </ul>
        <p className="small muted">
          Want the longer version? Read <Link to="/route">one person’s route</Link>, see{' '}
          <Link to="/days">good days from elsewhere</Link>, or read <Link to="/about">what this demonstration is and is not</Link>.
        </p>
      </section>
    </div>
  );
}
