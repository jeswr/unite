import { Link } from 'react-router';
import { PageHead } from '../ui/Layout';

export const DOES_NOT_SHOW: string[] = [
  'Representativeness, and the drawn sample at real scale.',
  'The phone and radio routes working for real. The views of them are mock-ups.',
  'Resistance to manipulation and flooding.',
  'Proof that each voice is one real person.',
  'Interview quality in less-proven languages. The Quechua and Bengali here are illustrative, not validated.',
  'That any institution will answer.',
  'Privacy, and the federation of independent operators who would run listening under a charter.',
  'Cost at scale.',
];

export function About() {
  return (
    <div className="wrap narrow">
      <PageHead eyebrow="About" title="What this demonstration is and is not">
        A clickable sketch of one method: listening to people about their days, drawing a picture with many parts, talking across
        languages, and asking institutions to answer in public.
      </PageHead>

      <section className="section" aria-labelledby="is">
        <h2 id="is">What it is</h2>
        <ul>
          <li>
            Five invented places and one invented circle, with about thirty invented conversations in each place. Every count is
            computed from those invented records, so the numbers agree with each other. None of them is a finding about Kisumu,
            Kraków, Medellín, Dhaka, Glasgow or anyone near Cusco.
          </li>
          <li>
            A scripted interviewer. It asks, follows general words down to an event, and reads back your own words. It holds no
            views and argues with nobody. In this demonstration nothing you type is stored or sent.
          </li>
          <li>
            A picture with five parts at every layer: said almost everywhere, said differently, said here, in tension, and not yet
            heard. Two counts travel with every finding: the share of people and the share of places and circles.
          </li>
          <li>
            Three invented example hosts and an invented register. No real institution, government, UN body or assembly has
            pledged, endorsed or taken part. The global room is a slow room of seven people drawn by lot; there is no global
            assembly here, and nothing is decided.
          </li>
          <li>
            The Quechua-speaking community near Cusco is invented. Its standing statement shows how one would appear; real ones are
            written by communities through their own process.
          </li>
        </ul>
      </section>

      <section className="section" aria-labelledby="not">
        <h2 id="not">What it does not show</h2>
        <ul>
          {DOES_NOT_SHOW.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="name">
        <h2 id="name">The name</h2>
        <p>
          ‘The Common Picture’ is a working name. It describes what is produced: a picture, not a plan, and a public undertaking with
          rounds, a method and a charter, closer to a census than to a product.
        </p>
      </section>

      <p style={{ fontFamily: 'var(--serif)', fontSize: '1.3rem' }}>A demonstration of method and nothing more.</p>
      <p>
        <Link to="/feedback?from=%2Fabout" className="btn secondary">
          Tell us what you think
        </Link>
      </p>
    </div>
  );
}
