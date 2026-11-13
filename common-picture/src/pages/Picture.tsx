import { useId, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { LAYER, LAYERS, TIER_LABEL } from '../data/layers';
import { buildPicture, pct, type Count, type Finding, type Split, type View } from '../data/picture';
import { REPLIES, STANDING_STATEMENT } from '../data/themes';
import type { Door } from '../data/types';
import { PageHead } from '../ui/Layout';
import { ExampleTag, NotWhatWasSaid, Words, langName } from '../ui/Words';

type DoorMode = 'both' | Door;

const VIEWS: { id: View; label: string }[] = [
  { id: 'world', label: 'World' },
  ...LAYERS.map((l) => ({ id: l.id as View, label: l.kind === 'circle' ? 'Quechua-speaking circle' : l.shortName })),
];

const DOOR_LABEL: Record<Door, string> = { open: 'Open door', drawn: 'Drawn sample' };

function isView(v: string | null): v is View {
  return !!v && VIEWS.some((x) => x.id === v);
}

export function PicturePage() {
  const [params, setParams] = useSearchParams();
  const param = params.get('layer');
  const view: View = isView(param) ? param : 'world';
  const [doors, setDoors] = useState<DoorMode>('both');
  const pic = buildPicture(view);
  const layer = view === 'world' ? null : LAYER[view];

  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === 'world') next.delete('layer');
    else next.set('layer', v);
    setParams(next, { replace: true });
  };

  const replies = (part: string) => REPLIES.filter((r) => r.layer === view && r.beside === part);

  return (
    <div className="wrap">
      <PageHead eyebrow="See · Edition 0 · demonstration" title="The picture">
        A picture for every layer, built upward from the layers beneath it in their own words, never by averaging. Every layer has
        the same five parts.
      </PageHead>

      <div role="group" aria-labelledby="layer-label">
        <p id="layer-label" className="eyebrow" style={{ margin: 0 }}>
          Layer
        </p>
        <div className="layer-picker">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <section className="card" aria-labelledby="layer-title">
        <div className="part-head" style={{ marginBottom: '0.4rem' }}>
          <h2 id="layer-title">{pic.title}</h2>
          <ExampleTag />
        </div>
        <p style={{ marginBottom: '0.6rem' }}>
          Built from <strong>{pic.totals.open + pic.totals.drawn}</strong> invented conversations: {pic.totals.open} through the
          open door and {pic.totals.drawn > 0 ? `${pic.totals.drawn} in the drawn sample` : 'none in a drawn sample'}.
          {layer && (
            <>
              {' '}
              Language: <span lang={layer.language.code}>{layer.language.endonym}</span> ({TIER_LABEL[layer.language.tier]} tier,
              illustrative). {layer.routeNote}
            </>
          )}
        </p>
        <p className="small muted" style={{ marginBottom: '0.8rem' }}>
          Two counts travel with every finding: the share of people who said it, and the share of{' '}
          {view === 'world' ? 'places and circles' : layer?.kind === 'circle' ? 'groups in the circle' : 'areas'} in which it
          appears. Something most people say is not yet something said everywhere.
        </p>
        <div className="btn-row" role="group" aria-labelledby="door-label">
          <span id="door-label" className="small" style={{ fontWeight: 600 }}>
            Show counts from:
          </span>
          <div className="seg">
            {(
              [
                ['both', 'Both doors, side by side'],
                ['drawn', 'Drawn sample'],
                ['open', 'Open door'],
              ] as [DoorMode, string][]
            ).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={doors === k} onClick={() => setDoors(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="small muted" style={{ margin: '0.6rem 0 0' }}>
          The open door is anyone who chose to take part. The drawn sample is people chosen at random and invited. Nothing is
          reweighted quietly: each finding says which door it rests on.
        </p>
        <Retention r={pic.retention} />
      </section>

      {/* 1 */}
      <Part n={1} cls="everywhere" title="Said almost everywhere" summary={`${pic.title}: said almost everywhere`}>
        <p className="muted">
          {view === 'world'
            ? 'Present in at least 5 of 6 places and circles, and said by at least 40% of people. This is the common ground.'
            : 'Said by at least half the people here, in most areas.'}
        </p>
        <div className="grid two">
          {pic.everywhere.map((f) => (
            <FindingCard key={f.id} f={f} doors={doors} />
          ))}
        </div>
        {pic.alsoHeard.length > 0 && (
          <p className="small" style={{ marginTop: '0.8rem' }}>
            <strong>Also heard here, by fewer:</strong>{' '}
            {pic.alsoHeard.map((f, i) => (
              <span key={f.id}>
                {i > 0 && '; '}“{f.title}” ({pct(f.people[f.restsOn])}% of people, {DOOR_LABEL[f.restsOn].toLowerCase()})
              </span>
            ))}
          </p>
        )}
        {replies('Said almost everywhere').map((r) => (
          <ReplyBox key={r.from} from={r.from} w={r.words} />
        ))}
      </Part>

      {/* 2 */}
      <Part n={2} cls="differently" title="Said differently" summary={`${pic.title}: said differently`}>
        <p className="muted">
          The same need taking different shapes. A short set of statements, each written from one side, with its size among the
          people who spoke to it.
        </p>
        <div className="grid">
          {pic.differently.map((s) => (
            <SplitCard key={s.id} s={s} doors={doors} world={view === 'world'} />
          ))}
        </div>
        {replies('Said differently').map((r) => (
          <ReplyBox key={r.from} from={r.from} w={r.words} />
        ))}
      </Part>

      {/* 3 */}
      <Part n={3} cls="here" title="Said here" summary={`${pic.title}: said here`}>
        <p className="muted">
          What is distinct to a few places or peoples, kept whole. Standing statements are shown as written, attributed, and never
          summarised.
        </p>
        {pic.standing && <Standing />}
        <div className="grid two" style={{ marginTop: '1rem' }}>
          {pic.here.map((f) => (
            <FindingCard key={f.id} f={f} doors={doors} />
          ))}
        </div>
        {pic.here.length === 0 && !pic.standing && <p>Nothing distinct to this layer in the example data.</p>}
      </Part>

      {/* 4 */}
      <Part n={4} cls="tension" title="In tension" summary={`${pic.title}: in tension`}>
        <p className="muted">
          Where one group’s good day depends on something that costs another’s. Shown as prominently as the common ground, because
          grievances stay in.
        </p>
        {pic.tensions.length === 0 && <p>No tension recorded at this layer in the example data.</p>}
        <div className="grid">
          {pic.tensions.map((t) => (
            <article key={t.tension.id} className="card" aria-labelledby={`t-${t.tension.id}`}>
              <h3 id={`t-${t.tension.id}`}>{t.tension.title}</h3>
              <p className="muted small">{t.tension.note}</p>
              <div className="tension-sides">
                <div className="side">
                  <FindingCard f={t.a} doors={doors} bare />
                </div>
                <span className="tension-vs" aria-hidden="true">
                  and
                </span>
                <div className="side">
                  <FindingCard f={t.b} doors={doors} bare />
                </div>
              </div>
              {t.tension.id === 'price' && (
                <p className="small" style={{ margin: '0.8rem 0 0' }}>
                  This tension is being worked through in a <Link to="/room">slow room of seven people drawn by lot</Link>.
                </p>
              )}
            </article>
          ))}
        </div>
      </Part>

      {/* 5 */}
      <Part n={5} cls="hidden" title="Not yet heard" summary={`${pic.title}: not yet heard`}>
        <p className="muted">Who is missing, by place, language, age and route.</p>
        <div className="grid two">
          {pic.notHeard.map((g) => (
            <div key={g.group} className="card">
              <h3>{g.group}</h3>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {g.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Part>
    </div>
  );
}

function Part(props: { n: number; cls: string; title: string; summary: string; children: ReactNode }) {
  const id = `part-${props.n}`;
  return (
    <section className={`part ${props.cls}`} aria-labelledby={id}>
      <div className="part-head">
        <h2 id={id}>
          <span className="part-num">{props.n}</span>
          {props.title}
        </h2>
        <NotWhatWasSaid summary={props.summary} />
      </div>
      {props.children}
    </section>
  );
}

function CountBox({ door, c, spread, rests }: { door: Door; c: Count; spread: string; rests: boolean }) {
  return (
    <div className={`count-box ${door}${rests ? ' rests' : ''}`}>
      <span className="door">
        {DOOR_LABEL[door]}
        {rests && ' · rests on this'}
      </span>
      {c.n === 0 ? (
        <span className="muted">No drawn sample here</span>
      ) : (
        <>
          <span className="count-num">{pct(c)}% of people</span>
          {spread && <> · {spread}</>}
          <span className="sr-only">
            {' '}
            ({c.k} of {c.n} people)
          </span>
          <div className="bar" aria-hidden="true">
            <span style={{ width: `${pct(c)}%` }} />
          </div>
        </>
      )}
    </div>
  );
}

function FindingCard({ f, doors, bare = false }: { f: Finding; doors: DoorMode; bare?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const spread = `${f.spread.k} of ${f.spread.n} ${f.spread.label}`;
  const shown: Door[] = doors === 'both' ? ['open', 'drawn'] : [doors];
  const body = (
    <div className="finding">
      <h3 className="finding-title">{f.title}</h3>
      <div className={`counts${shown.length === 2 ? ' both' : ''}`}>
        {shown.map((d) => (
          <CountBox key={d} door={d} c={f.people[d]} spread={spread} rests={f.restsOn === d} />
        ))}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        In: {f.spread.names.join(', ')}
      </p>
      <div>
        <button
          type="button"
          className="btn quiet small"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          disabled={f.quotes.length === 0}
        >
          {open ? 'Hide the words' : `Show the words behind this (${f.quotes.length})`}
          <span className="sr-only">: {f.title}</span>
        </button>
      </div>
      {open && (
        <div id={id} className="quotes reveal">
          {f.quotes.map((q) => (
            <figure key={q.layer + q.original} className="quote" style={{ margin: 0 }}>
              <Words w={q} />
              <figcaption className="who">
                {LAYER[q.layer].shortName} · {q.who} · invented example
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
  return bare ? body : <article className="card">{body}</article>;
}

function SplitCard({ s, doors, world }: { s: Split; doors: DoorMode; world: boolean }) {
  const shown: Door[] = doors === 'both' ? ['open', 'drawn'] : [doors];
  return (
    <article className="card" aria-labelledby={`split-${s.id}`}>
      <h3 id={`split-${s.id}`}>{s.question}</h3>
      {s.rows.map((r) => (
        <div key={r.key} className="split-row">
          <div>
            <p className="split-statement">{r.statement}</p>
            <p className="small muted" style={{ margin: '0.2rem 0 0' }}>
              {world ? `${r.layers.length} of ${LAYERS.length} places and circles: ` : 'Said in: '}
              {r.layers.join(', ')}
            </p>
          </div>
          <div className={`counts${shown.length === 2 ? ' both' : ''}`}>
            {shown.map((d) => (
              <CountBox
                key={d}
                door={d}
                c={d === 'drawn' && r.layers.every((n) => LAYERS.find((l) => l.shortName === n)?.size.drawn === 0) ? { k: 0, n: 0 } : r.people[d]}
                spread=""
                rests={false}
              />
            ))}
          </div>
        </div>
      ))}
    </article>
  );
}

function Standing() {
  return (
    <figure className="standing" style={{ margin: 0 }} aria-labelledby="standing-h">
      <p className="eyebrow" id="standing-h">
        Standing statement · shown whole, never summarised
      </p>
      <Words w={STANDING_STATEMENT.words} side />
      <figcaption className="who">
        <strong>{STANDING_STATEMENT.author}</strong> · {STANDING_STATEMENT.agreed} · {langName(STANDING_STATEMENT.words.lang)}{' '}
        recorded by a human listener
      </figcaption>
      <p className="small notice" style={{ marginTop: '0.8rem' }}>
        {STANDING_STATEMENT.framing}
      </p>
    </figure>
  );
}

function ReplyBox({ from, w }: { from: string; w: Parameters<typeof Words>[0]['w'] }) {
  return (
    <aside className="reply" style={{ marginTop: '1rem' }} aria-label={from}>
      <strong>{from}</strong> <ExampleTag>Invented</ExampleTag>
      <div style={{ marginTop: '0.4rem' }}>
        <Words w={w} />
      </div>
    </aside>
  );
}

function Retention({ r }: { r: ReturnType<typeof buildPicture>['retention'] }) {
  const [open, setOpen] = useState(false);
  const pass = r.survive >= r.threshold;
  return (
    <div className="notice blue" style={{ marginTop: '1rem' }}>
      <div className="retention">
        <span className="big" aria-hidden="true">
          {r.survive} of {r.of}
        </span>
        <div style={{ flex: '1 1 18rem' }}>
          <strong>Retention test.</strong> {r.survive} of {r.of} distinct minority themes from below survive into this layer;
          threshold in the charter: {r.threshold} of {r.of}. {pass ? 'Passes.' : 'Fails: this edition could not be confirmed.'}{' '}
          <ExampleTag />
          <br />
          <span className="small">{r.note}</span>
        </div>
        {r.items && (
          <button type="button" className="btn quiet small" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Hide the themes' : 'Which themes?'}
          </button>
        )}
      </div>
      {open && r.items && (
        <ul className="retention-items reveal">
          {r.items.map((i) => (
            <li key={i.label} className={i.survived ? '' : 'lost'}>
              <strong>{i.label}</strong> ({i.from}): {i.where}
              {!i.survived && ' — flagged for review by people.'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
