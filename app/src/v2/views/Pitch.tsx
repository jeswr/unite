// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// #/join-us — THE PITCH PAGE (design/v2 06 §6): what unite v2 asks the world
// for. Pure rendering of content-v2/pitch.ts — the words live in the content
// module (one reviewable file, the covenant walkthrough points at it); this
// view adds structure and nothing else. The non-claims carry the same visual
// weight as the claims — that is the page's character.

import { PITCH } from "../../content-v2/pitch.js";

export function Pitch(): React.JSX.Element {
  return (
    <section className="view">
      <h2>{PITCH.title}</h2>
      <p className="muted">{PITCH.tagline}</p>
      {PITCH.intro.map((p) => (
        <p key={p.slice(0, 32)} className="muted small">
          {p}
        </p>
      ))}

      <div className="v2-letter-section">
        <h3>{PITCH.claim.headline}</h3>
        {PITCH.claim.paragraphs.map((p) => (
          <p key={p.slice(0, 32)} className="small">
            {p}
          </p>
        ))}
        <h4>{PITCH.claim.groundsHeading}</h4>
        <p className="muted small">{PITCH.claim.groundsIntro}</p>
        <ul>
          {PITCH.claim.grounds.map((g) => (
            <li key={g.id}>
              <strong>{g.label}.</strong> {g.body}
              <p className="v2-seam-text">Check it yourself: {g.checkIt}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="v2-letter-section">
        <h3>{PITCH.evidence.heading}</h3>
        <p className="muted small">{PITCH.evidence.intro}</p>
        <ul>
          {PITCH.evidence.items.map((e) => (
            <li key={e.id}>
              <strong>{e.title}.</strong> {e.body}
              <p className="v2-seam-text">Where to look: {e.pointer}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="v2-letter-section">
        <h3>{PITCH.asks.heading}</h3>
        <p className="muted small">{PITCH.asks.intro}</p>
        <ul>
          {PITCH.asks.items.map((a) => (
            <li key={a.id}>
              <strong>{a.audience}:</strong> {a.ask}
              <p className="muted small">{a.detail}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="v2-letter-section">
        <h3>{PITCH.nonClaims.heading}</h3>
        <p className="muted small">{PITCH.nonClaims.intro}</p>
        <ul>
          {PITCH.nonClaims.items.map((n) => (
            <li key={n.id}>
              <strong>Not claimed: {n.notThis}</strong>
              <p className="muted small">{n.instead}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="v2-letter-section">
        <h3>{PITCH.notBuilt.heading}</h3>
        <p className="muted small">{PITCH.notBuilt.intro}</p>
        <ul>
          {PITCH.notBuilt.items.map((item) => (
            <li key={item.slice(0, 32)} className="muted small">
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="v2-letter-section">
        <h3>{PITCH.closing.heading}</h3>
        {PITCH.closing.paragraphs.map((p) => (
          <p key={p.slice(0, 32)} className="small">
            {p}
          </p>
        ))}
        <p className="muted small">
          The code, fixtures, and design documents:{" "}
          <a href={PITCH.closing.repoUrl} rel="noreferrer">
            {PITCH.closing.repoUrl}
          </a>
        </p>
        <p className="muted small">{PITCH.closing.contactNote}</p>
      </div>
    </section>
  );
}
