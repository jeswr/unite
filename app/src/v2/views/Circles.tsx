// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// #/circles — CIRCLE COMPOSITION (design/v2 04, 07 §3 V3): the machine-picked
// diverse-but-bridgeable partition, rendered as INVITATIONS with the honest
// "why this circle?" seam per composition case (lib/circles.ts — UNCHANGED
// engine composition; this view renders its record and adds nothing):
//
//   • diverse — the only variant that claims diversity;
//   • overflow — like-minded leftovers, open seats held, honestly labeled;
//   • cold-start — need-overlap only, no opinion map yet, no diversity claim;
//   • starter — "everyone so far", claims nothing.
//
// NO health metrics render here or anywhere (04 §4): no talk-share, no
// activity, no per-circle tallies — the framing is people and reasons, never
// numbers about people. Relational continuity is stated: composition runs at
// creation and seat-filling only; standing circles are never reshuffled.

import { useMemo } from "react";
import { type CircleComposition, composeCircles } from "../../lib/circles.js";
import { avatarColor, initials } from "../../ui/format.js";
import type { AggregateState } from "../../ui/hooks.js";
import { displayName } from "../../ui/hooks.js";
import { DEMO_CIRCLE } from "../demo-circle.js";
import { circleInvitationSeam } from "../seams.js";

/** The warm framing per composition kind (04 §2 — mechanism never unprompted). */
const KIND_FRAMING: Record<string, string> = {
  diverse: "a few people thinking about similar things from different places",
  overflow: "people who read the street similarly — seats held open for differing voices",
  "cold-start": "people who care about similar things — the map comes later",
  starter: "everyone so far",
};

function CircleCard({
  circle,
  index,
}: {
  circle: CircleComposition["circles"][number];
  index: number;
}): React.JSX.Element {
  return (
    <div className="v2-summary">
      <h3>Circle {index + 1}</h3>
      <p className="muted small">{KIND_FRAMING[circle.kind] ?? circle.kind}</p>
      <ul className="v2-seats">
        {circle.members.map((webId) => (
          <li key={webId} className="v2-seat">
            <span className="avatar" style={{ background: avatarColor(webId) }} aria-hidden="true">
              {initials(displayName(webId))}
            </span>{" "}
            {displayName(webId)}
          </li>
        ))}
        {circle.openSeats > 0 && circle.kind === "overflow" && (
          <li className="muted small">
            open seats, held for people who read the street differently
          </li>
        )}
      </ul>
      <p className="v2-seam-text">
        Why this circle? {circleInvitationSeam(circle.reason)}{" "}
        <a href="#/how">the long version →</a>
      </p>
    </div>
  );
}

export function Circles({ aggregate }: { aggregate: AggregateState }): React.JSX.Element {
  const composition = useMemo(() => {
    const result = aggregate.result;
    if (!result) return null;
    return composeCircles({
      participants: result.verified.map((v) => v.webId),
      needs: result.needs,
      resonances: result.resonances,
    });
  }, [aggregate.result]);

  return (
    <section className="view">
      <h2>How circles get put together</h2>
      <p className="muted small">
        A circle is four to six people, deliberately composed to span the community's different ways
        of seeing a question — with rules against tokenism built into the arithmetic (pairs or
        nothing), and honest labels when the mix can't support a diverse room yet. This page shows
        the composition the engine would run for this community, exactly as computed.
      </p>
      {aggregate.error && <p className="notice error">{aggregate.error}</p>}

      <div className="v2-summary">
        <h3>Your standing circle</h3>
        <p className="muted small">
          <a href={`#/circle/${DEMO_CIRCLE.slug}`}>{DEMO_CIRCLE.name}</a> — the demo's live room.
          Standing circles are never reshuffled to chase the map: composition runs when a circle is
          created and when an open seat fills, and that's all. Relationships are the point; the
          diversity metric is only a proxy for them.
        </p>
      </div>

      {composition === null ? (
        <p className="muted">Gathering…</p>
      ) : (
        <>
          {composition.circles.map((c, i) => (
            <CircleCard key={c.index} circle={c} index={i} />
          ))}
          {composition.waitlist.length > 0 && (
            <div className="v2-summary">
              <h3>Waiting warmly</h3>
              <p className="muted small">
                {composition.waitlist.map((w) => displayName(w)).join(", ")} — not seated yet rather
                than seated badly: a circle below four can't keep its promises, so the composer
                waits for enough people instead of faking a room.
              </p>
            </div>
          )}
        </>
      )}

      <p className="v2-seam-text">
        The full mechanism — the pairs rule, singleton folding, the overflow fallback — is on{" "}
        <a href="#/how">How unite listens</a>, and the composition code is open and fixture-tested.
      </p>
    </section>
  );
}
