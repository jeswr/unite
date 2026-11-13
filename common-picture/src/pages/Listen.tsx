import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { LANGUAGES, PLACES, TIER_LABEL, TIER_MEANING } from '../data/layers';
import type { LayerId } from '../data/types';
import {
  FOLLOW_UP_EXAMPLE,
  FOLLOW_UP_ORIGINAL,
  STAGES,
  TEN_STAGES,
  followUp,
  generalWord,
  type LangCode,
} from '../lib/interviewer';
import { extractPoints, type Answer, type Point } from '../lib/points';
import { PageHead } from '../ui/Layout';

const LANG_ORDER: LangCode[] = ['sw', 'pl', 'es', 'bn', 'en'];
const HOME_PLACE: Record<LangCode, LayerId> = { sw: 'kisumu', pl: 'krakow', es: 'medellin', bn: 'dhaka', en: 'glasgow' };

type Phase = 'setup' | 'chat' | 'heard' | 'consent' | 'done' | 'phone';
type Msg = { from: 'ai' | 'me'; text: string; original?: string };
type Decision = 'keep' | 'change' | 'drop';

export function Listen() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [lang, setLang] = useState<LangCode>('sw');
  const [route, setRoute] = useState<'web' | 'phone'>('web');

  return (
    <div className="wrap narrow">
      <PageHead eyebrow="Listen" title="The conversation">
        A private conversation about a real day in your life. No question is set by anyone, and the interviewer never gives a
        view: it only asks.
      </PageHead>
      {phase === 'setup' && (
        <Setup
          lang={lang}
          setLang={setLang}
          route={route}
          setRoute={setRoute}
          onBegin={() => setPhase(route === 'web' ? 'chat' : 'phone')}
        />
      )}
      {phase === 'phone' && <PhoneMock lang={lang} onBack={() => setPhase('setup')} />}
      {(phase === 'chat' || phase === 'heard' || phase === 'consent' || phase === 'done') && (
        <Conversation lang={lang} phase={phase} setPhase={setPhase} />
      )}
    </div>
  );
}

function Setup(props: {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  route: 'web' | 'phone';
  setRoute: (r: 'web' | 'phone') => void;
  onBegin: () => void;
}) {
  const tier = LANGUAGES[props.lang].tier;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        props.onBegin();
      }}
    >
      <fieldset>
        <legend>Choose a language</legend>
        <p className="small muted" style={{ marginTop: 0 }}>
          The screens stay in English for this demonstration; the interviewer’s questions are shown in your language beside
          them.
        </p>
        {LANG_ORDER.map((code) => {
          const l = LANGUAGES[code];
          return (
            <label key={code} className="choice">
              <input type="radio" name="lang" value={code} checked={props.lang === code} onChange={() => props.setLang(code)} />
              <span>
                <span lang={code}>{l.endonym}</span>
                {l.endonym !== l.name && <> · {l.name}</>}{' '}
                <span className="tag">{TIER_LABEL[l.tier]}</span>
              </span>
            </label>
          );
        })}
        <p className="small" style={{ marginBottom: 0 }}>
          <strong>Tier: {TIER_LABEL[tier]}.</strong> {TIER_MEANING[tier]} Tiers here are illustrative; no language has been
          assessed for this demonstration.
        </p>
      </fieldset>
      <fieldset>
        <legend>Choose a way in</legend>
        <label className="choice">
          <input type="radio" name="route" checked={props.route === 'web'} onChange={() => props.setRoute('web')} />
          <span>
            <strong>Type or speak on the web</strong>
            <br />
            <span className="small muted">Interactive in this demonstration. Speaking is shown as typing here.</span>
          </span>
        </label>
        <label className="choice">
          <input type="radio" name="route" checked={props.route === 'phone'} onChange={() => props.setRoute('phone')} />
          <span>
            <strong>An ordinary phone call</strong>
            <br />
            <span className="small muted">A mock-up of the free callback, for basic phones and people who prefer to talk.</span>
          </span>
        </label>
      </fieldset>
      <button type="submit" className="btn">
        Begin
      </button>
    </form>
  );
}

function StageList({ current }: { current: number }) {
  // current: index into TEN_STAGES of the stage now running
  return (
    <div aria-label="The ten stages" role="group">
      <ol className="stages">
        {TEN_STAGES.map((s, i) => (
          <li
            key={s.label}
            className={!s.inDemo ? 'skipped' : i < current ? 'done' : i === current ? 'now' : ''}
            aria-current={i === current ? 'step' : undefined}
          >
            {i + 1}. {s.label}
            {!s.inDemo && <span className="sr-only"> (left out of this short demonstration)</span>}
          </li>
        ))}
      </ol>
      <p className="small muted" style={{ marginTop: '0.4rem' }}>
        Compressed for the demonstration: “Ideas” and “Doubts” are left out.
      </p>
    </div>
  );
}

function Conversation({ lang, phase, setPhase }: { lang: LangCode; phase: Phase; setPhase: (p: Phase) => void }) {
  const [stage, setStage] = useState(0);
  const [awaitingFollowUp, setAwaitingFollowUp] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    {
      from: 'ai',
      text: 'I am an AI interviewer, not a person. Your words stay in the language you use; a translation is only a labelled view of them. At the end I will read back what I heard, and you decide what to keep.',
    },
    { from: 'ai', text: STAGES[0].prompt, original: lang === 'en' ? undefined : STAGES[0].original[lang] },
  ]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [draft, setDraft] = useState('');
  const [points, setPoints] = useState<Point[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [place, setPlace] = useState<LayerId>(HOME_PLACE[lang]);
  const [agree, setAgree] = useState(false);
  const [added, setAdded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [msgs.length]);

  const ask = (text: string, original?: string) => setMsgs((m) => [...m, { from: 'ai', text, original }]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    const s = STAGES[stage];
    setMsgs((m) => [...m, { from: 'me', text: t }]);
    const nextAnswers = [...answers, { stage: s.id, text: t, followUp: awaitingFollowUp }];
    setAnswers(nextAnswers);
    setDraft('');

    const fq = !awaitingFollowUp ? followUp(t) : null;
    if (fq) {
      const w = generalWord(t) ?? '';
      setAwaitingFollowUp(true);
      ask(fq, lang === 'en' ? undefined : FOLLOW_UP_ORIGINAL[lang].replace('{w}', w));
      inputRef.current?.focus();
      return;
    }
    setAwaitingFollowUp(false);
    if (stage + 1 < STAGES.length) {
      const n = STAGES[stage + 1];
      setStage(stage + 1);
      ask(n.prompt, lang === 'en' ? undefined : n.original[lang]);
      inputRef.current?.focus();
    } else {
      ask('Thank you. Here is what I heard. Keep, change or drop each point. Nothing is added anywhere unless you say so.');
      const ps = extractPoints(nextAnswers);
      setPoints(ps);
      setDecisions(Object.fromEntries(ps.map((p) => [p.id, 'keep' as Decision])));
      setPhase('heard');
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  const example = awaitingFollowUp ? FOLLOW_UP_EXAMPLE : STAGES[stage].example;
  const tenIndex = phase === 'chat' ? stage : phase === 'heard' ? 8 : 9;
  const kept = points.filter((p) => decisions[p.id] !== 'drop');
  const placeName = PLACES.find((p) => p.id === place)?.name ?? '';

  return (
    <section aria-label="Conversation">
      <StageList current={phase === 'done' ? 10 : tenIndex} />
      <div className="chat" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.from}`}>
            <span className="speaker">{m.from === 'ai' ? 'Interviewer (AI)' : 'You'}</span>
            {m.text}
            {m.original && (
              <div className="orig-prompt" lang={lang}>
                {m.original}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {phase === 'chat' && (
        <form onSubmit={onSubmit} className="card">
          <div className="field">
            <label htmlFor="answer">
              Your answer
              <span className="hint">
                {' '}
                In any of the five languages. {awaitingFollowUp ? 'A real moment is enough.' : STAGES[stage].label + '.'}
              </span>
            </label>
            <textarea id="answer" ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} />
          </div>
          <div className="btn-row">
            <button type="submit" className="btn" disabled={!draft.trim()}>
              Send answer
            </button>
            <button type="button" className="btn secondary" onClick={() => send(example)}>
              Use an example answer
            </button>
          </div>
          <p className="small muted" style={{ margin: '0.6rem 0 0' }}>
            Example answers are invented. If you write a general word such as “money” or “the government”, the interviewer asks
            for a time it showed up in your day.
          </p>
        </form>
      )}

      {phase === 'heard' && (
        <section aria-labelledby="heard" className="section">
          <h2 id="heard">Here is what I heard</h2>
          <p className="muted">These are your own words, picked from your answers. Nothing has been reworded.</p>
          {points.length === 0 && <p>No points yet. Go back and answer at least one question.</p>}
          <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.8rem' }}>
            {points.map((p, i) => {
              const d = decisions[p.id];
              return (
                <li key={p.id} className={`card point${d === 'drop' ? ' dropped' : ''}`}>
                  <span className="eyebrow" style={{ margin: 0 }}>
                    Point {i + 1} · {p.label}
                  </span>
                  <p className="point-text">“{d === 'change' ? edits[p.id] ?? p.text : p.text}”</p>
                  <div className="btn-row" role="group" aria-label={`Point ${i + 1}`}>
                    {(['keep', 'change', 'drop'] as Decision[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={`btn small ${d === k ? '' : 'quiet'}`}
                        aria-pressed={d === k}
                        aria-label={`${k[0].toUpperCase() + k.slice(1)} point ${i + 1}`}
                        onClick={() => {
                          setDecisions({ ...decisions, [p.id]: k });
                          if (k === 'change' && edits[p.id] === undefined) setEdits({ ...edits, [p.id]: p.text });
                        }}
                      >
                        {k[0].toUpperCase() + k.slice(1)}
                      </button>
                    ))}
                  </div>
                  {d === 'change' && (
                    <div className="field" style={{ margin: 0 }}>
                      <label htmlFor={`edit-${p.id}`}>Change point {i + 1} to say</label>
                      <textarea
                        id={`edit-${p.id}`}
                        rows={2}
                        value={edits[p.id] ?? p.text}
                        onChange={(e) => setEdits({ ...edits, [p.id]: e.target.value })}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <button type="button" className="btn" onClick={() => setPhase('consent')} disabled={points.length === 0}>
            Continue with {kept.length} kept {kept.length === 1 ? 'point' : 'points'}
          </button>
        </section>
      )}

      {phase === 'consent' && (
        <section aria-labelledby="consent" className="section card">
          <h2 id="consent">Adding to the picture</h2>
          <div className="field">
            <label htmlFor="place">Your place</label>
            <select id="place" value={place} onChange={(e) => setPlace(e.target.value as LayerId)}>
              {PLACES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <h3>What happens to your words</h3>
          <ul>
            <li>Your {kept.length} kept points join the picture for {placeName}, and through it the world picture.</li>
            <li>Your words in your language are the record. Any translation is a labelled view of them.</li>
            <li>Your name is never attached. Nobody, including any institution, sees who said what.</li>
            <li>Dropped points are deleted. You can withdraw kept points until the next edition is published.</li>
            <li>Points you add here come through the open door. Only the drawn sample can lead to a priority or an ask.</li>
          </ul>
          <label className="choice">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>Add my kept points to the picture for {placeName}</span>
          </label>
          <div className="btn-row" style={{ marginTop: '0.8rem' }}>
            <button
              type="button"
              className="btn"
              disabled={!agree}
              onClick={() => {
                setAdded(true);
                setPhase('done');
              }}
            >
              Add my points
            </button>
            <button
              type="button"
              className="btn quiet"
              onClick={() => {
                setAdded(false);
                setPhase('done');
              }}
            >
              Leave without adding
            </button>
          </div>
        </section>
      )}

      {phase === 'done' && (
        <section aria-labelledby="done" className="section card" role="status">
          <h2 id="done">{added ? 'Thank you. Your points would now be part of the picture.' : 'Thank you. Nothing was added.'}</h2>
          <p>
            <strong>In this demonstration nothing is stored.</strong> Your words have not left this page, and they are gone when
            you close it.
          </p>
          {added && (
            <p>
              In the real picture, you would hear back by text or on the web when the picture for {placeName} is published, and
              again if an institution answers something your points are part of.
            </p>
          )}
          <div className="btn-row">
            <Link className="btn" to="/picture">
              See the picture
            </Link>
            <Link className="btn secondary" to="/days">
              Hear good days from elsewhere
            </Link>
          </div>
        </section>
      )}
    </section>
  );
}

const PHONE_LINES: Record<LangCode, { intro: string; ask: string; read: string; keys: string }> = {
  sw: {
    intro: 'Habari. Mimi ni kompyuta, si mtu. Maneno yako yatabaki kwa Kiswahili, na jina lako halitaonyeshwa popote.',
    ask: 'Niambie kuhusu jana. Siku yako ilianzaje?',
    read: 'Nilisikia mambo manne. Hili ni la kwanza…',
    keys: 'Bonyeza 1 kubakiza, 2 kubadilisha, 3 kufuta.',
  },
  pl: {
    intro: 'Dzień dobry. Jestem komputerem, nie człowiekiem. Pana/Pani słowa zostaną po polsku, a nazwisko nie pojawi się nigdzie.',
    ask: 'Proszę opowiedzieć o wczoraj. Jak zaczął się dzień?',
    read: 'Usłyszałem cztery rzeczy. Pierwsza…',
    keys: 'Proszę nacisnąć 1, aby zachować, 2, aby zmienić, 3, aby usunąć.',
  },
  es: {
    intro: 'Hola. Soy una computadora, no una persona. Sus palabras quedan en español y su nombre no aparecerá en ninguna parte.',
    ask: 'Cuénteme de ayer. ¿Cómo empezó su día?',
    read: 'Escuché cuatro cosas. La primera…',
    keys: 'Marque 1 para guardar, 2 para cambiar, 3 para borrar.',
  },
  bn: {
    intro: 'হ্যালো। আমি একটি কম্পিউটার, মানুষ নই। আপনার কথা বাংলাতেই থাকবে, আপনার নাম কোথাও দেখানো হবে না।',
    ask: 'গতকালের কথা বলুন। আপনার দিনটা কীভাবে শুরু হয়েছিল?',
    read: 'আমি চারটি কথা শুনেছি। প্রথমটি…',
    keys: 'রাখতে ১, বদলাতে ২, বাদ দিতে ৩ চাপুন।',
  },
  en: {
    intro: 'Hello. I am a computer, not a person. Your words stay in English, and your name will not be shown anywhere.',
    ask: 'Tell me about yesterday. How did your day begin?',
    read: 'I heard four things. Here is the first…',
    keys: 'Press 1 to keep, 2 to change, 3 to drop.',
  },
};

function PhoneMock({ lang, onBack }: { lang: LangCode; onBack: () => void }) {
  const l = PHONE_LINES[lang];
  const steps = [
    { title: 'Ring and hang up', text: 'The person rings the number they heard on the radio and hangs up after one ring. It costs nothing.' },
    { title: 'A free callback', text: 'Within a minute the system calls back, so the person pays nothing for the conversation.' },
    { title: 'It says what it is', voice: l.intro, en: PHONE_LINES.en.intro.replace('English', 'your language') },
    { title: 'It asks about yesterday', voice: l.ask, en: PHONE_LINES.en.ask },
    { title: 'About twelve minutes of conversation', text: 'The same stages as on the web, by voice. General words are followed down to an event.' },
    { title: 'Read-back by voice', voice: l.read, en: PHONE_LINES.en.read },
    { title: 'Keep, change or drop by voice or keypad', voice: l.keys, en: PHONE_LINES.en.keys },
    { title: 'Hearing back', text: 'A month on, a text message says what many people nearby said, and when the radio will read out the local picture.' },
  ];
  return (
    <section aria-labelledby="phone-h" className="phone-script">
      <p className="notice">
        <strong>Mock-up.</strong> The phone route does not work in this demonstration. This is the script it would follow.
      </p>
      <h2 id="phone-h">An ordinary phone call</h2>
      <ol>
        {steps.map((s) => (
          <li key={s.title}>
            <strong>{s.title}.</strong> {s.text}
            {s.voice && (
              <div className="card" style={{ marginTop: '0.4rem' }}>
                <span className="trans-label">Voice · {LANGUAGES[lang].name}</span>
                <p className="orig" lang={lang} style={{ fontFamily: 'var(--serif)', margin: '0 0 0.3rem' }}>
                  {s.voice}
                </p>
                {lang !== 'en' && (
                  <p className="muted small" style={{ margin: 0 }}>
                    <span className="trans-label">Translated from {LANGUAGES[lang].name}</span>
                    {s.en}
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="btn-row">
        <button type="button" className="btn quiet" onClick={onBack}>
          Back to the choice
        </button>
        <Link className="btn secondary" to="/route">
          Follow one person’s route by phone
        </Link>
      </div>
    </section>
  );
}
