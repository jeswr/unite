import { useState } from 'react';
import { Link } from 'react-router';
import { ROOM, ROOM_MESSAGES, ROOM_SO_FAR, TALK, TODAY, TODAY_LABEL, daysBetween } from '../data/content';
import { LAYER } from '../data/layers';
import { PageHead } from '../ui/Layout';
import { ExampleTag, NotWhatWasSaid, Words, langName } from '../ui/Words';

export function Room() {
  const total = daysBetween(ROOM.opened, ROOM.closes) + 1;
  const today = daysBetween(ROOM.opened, TODAY.toISOString().slice(0, 10)) + 1;
  const [mine, setMine] = useState('');
  const [posted, setPosted] = useState<string | null>(null);

  return (
    <div className="wrap narrow">
      <PageHead eyebrow="Talk · a slow room" title={ROOM.title}>
        Seven people drawn by lot across the five places, working through one tension from the picture. The room decides nothing:
        it shows how strangers in five languages work a tension through.
      </PageHead>

      <section className="card" aria-labelledby="room-facts">
        <h2 id="room-facts" className="sr-only">
          About this room
        </h2>
        <p style={{ marginBottom: '0.4rem' }}>
          <strong>
            Day {today} of {total}
          </strong>{' '}
          · open {ROOM.opened.slice(8)}–{ROOM.closes.slice(8)} November 2026 · today is {TODAY_LABEL} <ExampleTag />
        </p>
        <div className="days-open" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={i + 1 < today ? 'past' : i + 1 === today ? 'today' : ''} />
          ))}
        </div>
        <p className="small muted" style={{ margin: '0.6rem 0 0' }}>
          A slow room stays open for several days so that people in different time zones can each take part. Each person writes
          where they stand before reading the others. Messages appear in the reader’s language with the original beside them.
          Seats: 2 Kisumu, 2 Dhaka, 1 Kraków, 1 Medellín, 1 Glasgow (all invented).
        </p>
      </section>

      <section className="section" aria-labelledby="stand">
        <h2 id="stand">Write where you stand before you read the others</h2>
        {posted === null ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (mine.trim()) setPosted(mine.trim());
            }}
          >
            <div className="field">
              <label htmlFor="stand-text">
                {ROOM.question}
                <span className="hint"> The others’ messages stay hidden until you post yours.</span>
              </label>
              <textarea id="stand-text" value={mine} onChange={(e) => setMine(e.target.value)} />
            </div>
            <div className="btn-row">
              <button type="submit" className="btn" disabled={!mine.trim()}>
                Post and read the others
              </button>
              <button type="button" className="btn secondary" onClick={() => setPosted(ROOM.visitorExample)}>
                Use an example answer
              </button>
            </div>
            <p className="small muted">
              Seven messages are waiting, hidden. <span aria-hidden="true">▒▒▒▒▒▒▒</span>
            </p>
          </form>
        ) : (
          <div className="reveal">
            <article className="card msg" style={{ background: 'var(--blue-soft)' }}>
              <div className="msg-head">
                <span>
                  <strong>You</strong> · visitor · day {today}
                </span>
                <span>Not stored in this demonstration</span>
              </div>
              <p style={{ margin: 0 }}>{posted}</p>
            </article>
            <h3 style={{ marginTop: '1.5rem' }}>The others, in your language with the original beside it</h3>
            <div className="grid" aria-live="polite">
              {ROOM_MESSAGES.map((m) => (
                <article key={m.id} className="card msg">
                  <div className="msg-head">
                    <span>
                      <strong>{m.seat}</strong> · writes in {langName(m.words.lang)}
                    </span>
                    <span>Day {m.day}</span>
                  </div>
                  <Words w={m.words} side readerFirst />
                </article>
              ))}
            </div>
            <aside className="card" style={{ marginTop: '1rem' }} aria-labelledby="so-far">
              <h3 id="so-far">So far</h3>
              <p>{ROOM_SO_FAR}</p>
              <NotWhatWasSaid summary="The room so far" />
            </aside>
          </div>
        )}
      </section>

      <TalkItThrough />

      <p className="small muted">
        Back to <Link to="/picture">the picture</Link>, where this tension sits under “In tension”.
      </p>
    </div>
  );
}

type Stance = 'agree' | 'disagree' | 'unsure';

function TalkItThrough() {
  const [open, setOpen] = useState(false);
  const [stance, setStance] = useState<Stance | null>(null);
  const [reply, setReply] = useState('');
  const [done, setDone] = useState(false);
  const reasons =
    stance === 'agree'
      ? TALK.disagreeReasons
      : stance === 'disagree'
        ? TALK.agreeReasons
        : stance === 'unsure'
          ? [TALK.agreeReasons[0], TALK.disagreeReasons[0]]
          : [];

  return (
    <section className="section card" aria-labelledby="talk-h" style={{ borderColor: 'var(--plum)' }}>
      <p className="eyebrow">Private · about five minutes</p>
      <h2 id="talk-h">Talk it through</h2>
      <p>
        A private conversation on one statement. The go-between shows you reasons given by people who answered differently,
        translated and marked as such, and asks what, if anything, is true in them for you. It gives no view of its own, and
        nothing you write here is shared.
      </p>
      <blockquote style={{ margin: '0 0 1rem', fontFamily: 'var(--serif)', fontSize: '1.15rem' }}>“{TALK.statement}”</blockquote>
      {!open ? (
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          Talk it through
        </button>
      ) : (
        <div className="reveal">
          <div className="chat">
            <div className="bubble ai">
              <span className="speaker">Go-between (AI)</span>
              Where do you stand on this statement?
            </div>
          </div>
          {stance === null ? (
            <div className="btn-row" role="group" aria-label="Where you stand">
              <button type="button" className="btn quiet" onClick={() => setStance('agree')}>
                I agree
              </button>
              <button type="button" className="btn quiet" onClick={() => setStance('disagree')}>
                I disagree
              </button>
              <button type="button" className="btn quiet" onClick={() => setStance('unsure')}>
                I am not sure
              </button>
            </div>
          ) : (
            <>
              <div className="chat">
                <div className="bubble me">
                  <span className="speaker">You</span>
                  {stance === 'agree' ? 'I agree' : stance === 'disagree' ? 'I disagree' : 'I am not sure'}
                </div>
                <div className="bubble ai">
                  <span className="speaker">Go-between (AI)</span>
                  Here are reasons given by people who answered {stance === 'unsure' ? 'each way' : 'differently'}. Each is
                  translated, and the original is beside it.
                </div>
              </div>
              <div className="grid">
                {reasons.map((r) => (
                  <figure key={r.words.original} className="card" style={{ margin: 0 }}>
                    <Words w={r.words} side readerFirst />
                    <figcaption className="who">
                      Someone in {LAYER[r.layer].kind === 'circle' ? 'the Quechua-speaking circle' : LAYER[r.layer].shortName} ·
                      invented example
                    </figcaption>
                  </figure>
                ))}
              </div>
              <div className="chat">
                <div className="bubble ai">
                  <span className="speaker">Go-between (AI)</span>
                  What, if anything, is true in this for you?
                </div>
              </div>
              {done ? (
                <p role="status" className="notice">
                  Thank you. That stays with you: nothing from Talk it through is shared or added to the picture.
                </p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setDone(true);
                  }}
                >
                  <div className="field">
                    <label htmlFor="talk-reply">What, if anything, is true in this for you?</label>
                    <textarea id="talk-reply" value={reply} onChange={(e) => setReply(e.target.value)} rows={3} />
                  </div>
                  <div className="btn-row">
                    <button type="submit" className="btn">
                      Finish
                    </button>
                    <button type="button" className="btn secondary" onClick={() => setReply(TALK.example)}>
                      Use an example answer
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
