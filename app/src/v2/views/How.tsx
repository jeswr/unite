// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// #/how — "HOW UNITE LISTENS" (design/v2 03 §6 second layer, 07 §3 V5): the
// full out-of-flow explanation, rendered from content-v2/how-listens.ts —
// the ONE reviewable content module (the core's earlier inline copy is
// reconciled away; the words now have exactly one home). Every in-flow
// seam's "the long version →" lands here. The v1 instrument views are linked
// IN PLACE (same session, same demo pods, same engine — hiding them would
// fail the reveal test this page runs on itself).

import { HOW_LISTENS } from "../../content-v2/how-listens.js";
import { MIRROR_DRAFT_PLAN } from "../../lib/mirror-draft.js";
import { SURFACES, surfaceHref } from "../../scope/surface.js";

export function How(): React.JSX.Element {
  const loc = typeof window === "undefined" ? null : window.location;
  // v2→v1 must carry the v2 surface's forced scope (society) so the instrument
  // views land in the SAME deliberation, not the default apps scope.
  const v1 = (hash: string) => surfaceHref("v1", loc?.search, hash, SURFACES.v2.forcesScope);
  const c = HOW_LISTENS;

  return (
    <section className="view">
      <h2>{c.intro.title}</h2>
      <blockquote className="muted small" style={{ margin: "0.4rem 0", fontStyle: "italic" }}>
        “{c.intro.handshakeRecap}”
      </blockquote>
      {c.intro.paragraphs.map((p) => (
        <p key={p.slice(0, 32)} className="muted small">
          {p}
        </p>
      ))}

      <div className="v2-letter-section" id="when">
        <h3>{c.whenWeSurface.heading}</h3>
        <p className="muted small">{c.whenWeSurface.intro}</p>
        <ul>
          {c.whenWeSurface.moments.map((m) => (
            <li key={m.id}>
              <strong>{m.moment}.</strong> {m.what}
              <p className="muted small">{m.how}</p>
            </li>
          ))}
        </ul>
        <h4>{c.whenWeSurface.neverHeading}</h4>
        <ul>
          {c.whenWeSurface.never.map((n) => (
            <li key={n.slice(0, 32)} className="muted small">
              {n}
            </li>
          ))}
        </ul>
      </div>

      <div className="v2-letter-section" id="reveal-test">
        <h3>{c.revealTest.heading}</h3>
        <blockquote className="small" style={{ margin: "0.4rem 0" }}>
          {c.revealTest.rule}
        </blockquote>
        {c.revealTest.paragraphs.map((p) => (
          <p key={p.slice(0, 32)} className="muted small">
            {p}
          </p>
        ))}
        <p className="small">
          <strong>{c.revealTest.invitation}</strong>
        </p>
      </div>

      <div className="v2-letter-section" id="your-data">
        <h3>{c.yourData.heading}</h3>
        {c.yourData.intro.map((p) => (
          <p key={p.slice(0, 32)} className="muted small">
            {p}
          </p>
        ))}
        <ul>
          {c.yourData.points.map((p) => (
            <li key={p.id}>
              <strong>{p.label}.</strong> <span className="muted small">{p.body}</span>
            </li>
          ))}
        </ul>
      </div>

      <h3 style={{ marginTop: "1.2rem" }}>{c.mechanismsHeading}</h3>
      <p className="muted small">{c.mechanismsIntro}</p>
      {c.groups.map((group) => (
        <div className="v2-letter-section" id={group.id} key={group.id}>
          <h3>{group.label}</h3>
          <p className="muted small">{group.intro}</p>
          <ul>
            {c.mechanisms
              .filter((m) => m.group === group.id)
              .map((m) => (
                <li key={m.id} id={m.id}>
                  <strong>{m.name}.</strong> <span className="small">{m.plain}</span>
                  {m.when !== undefined && (
                    <p className="muted small">When you meet it: {m.when}</p>
                  )}
                  {m.never !== undefined && <p className="muted small">Never: {m.never}</p>}
                  <p className="v2-seam-text">Where it lives: {m.source}</p>
                </li>
              ))}
          </ul>
        </div>
      ))}

      <div className="v2-letter-section" id="residuals">
        <h3>{c.residuals.heading}</h3>
        <p className="muted small">{c.residuals.intro}</p>
        <ul>
          {c.residuals.items.map((r) => (
            <li key={r.id}>
              <strong>{r.name}.</strong> <span className="muted small">{r.body}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="v2-letter-section" id="contest">
        <h3>{c.contest.heading}</h3>
        {c.contest.paragraphs.map((p) => (
          <p key={p.slice(0, 32)} className="muted small">
            {p}
          </p>
        ))}
      </div>

      <div className="v2-letter-section" id="instruments">
        <h3>{c.instruments.heading}</h3>
        <p className="muted small">{c.instruments.body}</p>
        <ul>
          {c.instruments.links.map((l) => (
            <li key={l.route}>
              <a href={v1(l.route)}>{l.label}</a> <span className="muted small">— {l.note}</span>
            </li>
          ))}
        </ul>
        <p className="muted small">
          The demo's drafter lexicon version: {MIRROR_DRAFT_PLAN}. The engine is open source — the
          code, its tests, and this design are in the{" "}
          <a href="https://github.com/jeswr/unite" rel="noreferrer">
            unite repository
          </a>
          .
        </p>
      </div>
    </section>
  );
}
