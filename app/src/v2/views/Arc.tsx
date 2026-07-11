// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// #/arc — THE FIVE-MINUTE WALK (design/v2 06 §2–3): the scripted demo arc a
// cold visitor can run unaided. It stages nothing it doesn't say: the honesty
// line is the first thing on the page (06 §2, verbatim), the personas are
// visibly fictional seats, and beat 3 carries the un-tuned-drafter rule out
// loud (no choreographed correction beat — an earlier draft of the script
// did exactly that and it fails the reveal test). Every beat names the
// covenant clause it exercises, so this page doubles as the covenant's
// acceptance walkthrough (07 §5).

import { avatarColor, initials } from "../../ui/format.js";
import { DEMO_CIRCLE } from "../demo-circle.js";
import { MAPLE_CROSSING } from "../demo-stories.js";
import { PERSONA_SEATS } from "../personas.js";

/** The 06 §2 honesty line, verbatim — the demo's first screen, one line. */
export const STAGED_HONESTY_LINE =
  "This is a staged neighbourhood with made-up people — but nothing about how it works is " +
  "staged. Everything you'll see computed is computed for real, in your browser, from their words.";

/** One arc beat: what to do, where, and the covenant clause it exercises. */
export interface ArcBeat {
  readonly n: number;
  readonly title: string;
  readonly what: string;
  /** Where the beat happens (a route in this app). */
  readonly href: string;
  readonly hrefLabel: string;
  /** The covenant clause(s) this beat exercises (07 §5 — the walkthrough). */
  readonly covenant: string;
}

export const ARC_BEATS: readonly ArcBeat[] = [
  {
    n: 1,
    title: "Arrive",
    what:
      "The handshake is waiting in the circle — the notetaker says what it is, what it listens " +
      "for, and where everything you say lives. No signup, no forms. Your seat is the newcomer's.",
    href: `#/circle/${DEMO_CIRCLE.slug}`,
    hrefLabel: "open the circle",
    covenant: "P5 — one honest handshake; the sensing disclosed at the door",
  },
  {
    n: 2,
    title: "Speak",
    what:
      "Answer the mornings prompt in your own words — a memory, a wish, a gripe. If you'd " +
      "rather keep momentum, borrow the suggested memory in the composer: it is visibly a prop, " +
      "never a hidden rail.",
    href: `#/circle/${DEMO_CIRCLE.slug}`,
    hrefLabel: "say it your way",
    covenant: "P1 — responsiveness: what you say is heard, not queued",
  },
  {
    n: 3,
    title: "Be heard",
    what:
      'A mirror lands: "Hearing you: … Close?" It comes from the same un-tuned deterministic ' +
      "drafter the product ships — NOT a version rigged to over-read so a correction moment can " +
      "perform on cue. A template genuinely misreads often enough on its own; when it happens to " +
      "land clean, stress it with something harder — the fix button is the honest path either way. " +
      "Nothing enters the shared picture unless you adopt it.",
    href: `#/circle/${DEMO_CIRCLE.slug}`,
    hrefLabel: "meet the mirror",
    covenant: "P6 — non-advocacy: the machine drafts, you decide; adoption is yours",
  },
  {
    n: 4,
    title: "Feel the community",
    what:
      "After you adopt, the notetaker deals one statement from someone across the map. React to " +
      "it — and notice the real distribution appears only AFTER your own take is in. Then watch " +
      "the circle's living summary gain your phrase.",
    href: `#/circle/${DEMO_CIRCLE.slug}`,
    hrefLabel: "react to a neighbour",
    covenant: "P4 — elicit-before-expose; P3 — your words have a visible fate",
  },
  {
    n: 5,
    title: "Meet the difference warmly",
    what:
      'The summary\'s "where we genuinely differ" block holds two sincere ways of seeing the ' +
      "traffic question — both in the group's words, rendered with the same warmth as agreement. " +
      'Tap "why this?" on anything machine-made and it answers from its literal fields.',
    href: `#/circle/${DEMO_CIRCLE.slug}`,
    hrefLabel: "find the differ block",
    covenant: "P7 — dissent carried whole; P5 — a seam on every machine-made object",
  },
  {
    n: 6,
    title: "See consequence",
    what:
      "The Maple crossing's fate-trail: from a morning chat to Maria's costed options (with her " +
      'honestly-tiered chip), to the council\'s answer — including the honest "not yet" — to the ' +
      "paint on the road and the scheduled check-in.",
    href: `#/story/${MAPLE_CROSSING.slug}`,
    hrefLabel: "read the fate-trail",
    covenant: "P3 — fate: no idea disappears into a graveyard",
  },
  {
    n: 7,
    title: "The letter",
    what:
      "The month's digest on the commons: what emerged, where people genuinely differ in their " +
      "own words, what changed because people spoke, and one invitation — bring someone who sees " +
      "the street differently.",
    href: "#/commons",
    hrefLabel: "read the letter",
    covenant: "P7 + P10 — reading is participation; dissent is a section, not a footnote",
  },
];

export function Arc(): React.JSX.Element {
  return (
    <section className="view">
      <h2>The five-minute walk</h2>
      <p className="small">
        <strong>{STAGED_HONESTY_LINE}</strong>
      </p>
      <p className="muted small">
        When you're done, one tap opens <a href="#/curtain">what was running the whole time</a> —
        the thirty-minute version for anyone who wants to verify rather than feel. And if you want
        to know what we're asking the world for, that's <a href="#/join-us">the pitch</a>.
      </p>

      <div className="v2-summary">
        <h3>The seats</h3>
        <p className="muted small">
          Eight made-up neighbours — illustrated seats, each labeled a demo voice — and one real
          seat: yours.
        </p>
        <ul className="v2-seats">
          {PERSONA_SEATS.map((p) => (
            <li key={p.key} className="v2-seat">
              <span
                className="avatar"
                style={{
                  background: avatarColor(`https://demo.unite.example/people/${p.key}/profile#me`),
                }}
                aria-hidden="true"
              >
                {initials(p.name)}
              </span>{" "}
              <strong>{p.name}</strong> <span className="muted small">— {p.intro}</span>{" "}
              {!p.you && <span className="badge demo">demo voice</span>}
              {p.you && <span className="badge">your seat</span>}
            </li>
          ))}
        </ul>
      </div>

      <ol className="v2-arc" aria-label="the walk, beat by beat">
        {ARC_BEATS.map((b) => (
          <li key={b.n} className="v2-letter-section">
            <h3>
              {b.n}. {b.title}
            </h3>
            <p className="small">{b.what}</p>
            <p className="muted small">
              <a href={b.href}>{b.hrefLabel} →</a>
            </p>
            <p className="v2-seam-text">covenant check: {b.covenant}</p>
          </li>
        ))}
      </ol>

      <p className="muted small">
        This walk is also the design's acceptance test: every beat exercises a clause of the
        presentation covenant, and the walkthrough passing is what "done" means for this surface.
        Nothing you type leaves the browser — the demo forgets everything when you close it.
      </p>
    </section>
  );
}
