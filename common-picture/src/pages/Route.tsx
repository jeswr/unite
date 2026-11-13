import { REHEMA, type RouteStep } from '../data/content';
import { PageHead } from '../ui/Layout';
import { langName } from '../ui/Words';

function Phone({ s }: { s: NonNullable<RouteStep['screen']> }) {
  const top: Record<typeof s.kind, string> = {
    sms: 'Messages',
    voice: 'In call · voice',
    keypad: 'In call · keypad',
    call: 'Phone',
    radio: 'On the radio',
  };
  return (
    <figure className="phone" style={{ margin: 0 }} aria-label={`Phone screen mock-up: ${top[s.kind]}`}>
      <div className="screen-top" aria-hidden="true">
        <span>{top[s.kind]}</span>
        <span>▮▮▮ ▭</span>
      </div>
      <div>
        {s.lines.map((l) => (
          <div key={l.original} className="line">
            <div lang={l.lang}>{l.original}</div>
            {l.translation && (
              <div className="tr">
                Translated from {langName(l.lang)}: {l.translation}
              </div>
            )}
          </div>
        ))}
      </div>
      <span className="mock" aria-hidden="true">
        Mock-up
      </span>
    </figure>
  );
}

export function RoutePage() {
  return (
    <div className="wrap">
      <PageHead eyebrow="Listen · by phone" title="One person’s route">
        Rehema is an invented example. She sells vegetables in a town in western Kenya and has a basic phone. She never downloads
        anything, reads a screen or learns a new word.
      </PageHead>
      <p className="notice">
        <strong>Mock-up.</strong> The phone, text and radio routes do not run in this demonstration. The screens show how they
        would look. The county’s reply is an invented example.
      </p>
      <ol className="timeline" style={{ marginTop: '2rem' }}>
        {REHEMA.map((s, i) => (
          <li key={s.id}>
            <div>
              <p className="eyebrow" style={{ marginBottom: '0.2rem' }}>
                Step {i + 1} · {s.when}
              </p>
              <h2 style={{ fontSize: '1.3rem' }}>{s.title}</h2>
              <p className="muted">{s.text}</p>
            </div>
            {s.screen && <Phone s={s.screen} />}
          </li>
        ))}
      </ol>
    </div>
  );
}
