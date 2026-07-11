// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// #/commons — the calm ambient home (design/v2 02 §6): the GARDEN (the
// collective state as a constellation — non-numeric, slow, no individual
// points, text equivalent), the LETTER (lib/digest — four parts, differ
// mandatory, k-floored), your circle, and one gentle prompt. No feeds, no
// tallies, no trending, no re-engagement anything.
//
// Garden data = the same engine outputs as v1's opinion map
// (buildMatrix → cluster → projectParticipants) rendered at the periphery:
// each opinion cluster is a soft glow at its members' centroid; each
// k-cleared common-ground theme (digest.emerged) is a bridge between them.
// Individual points are NEVER drawn — your own position lives in your
// notebook, visible only to you (02 §6).

import { useEffect, useMemo, useState } from "react";
import { demoForDeliberation } from "../../demo/pods.js";
import { assembleDigest, type Digest, type DigestStatement } from "../../lib/digest.js";
import { DEFAULT_K_THRESHOLD } from "../../lib/fut.js";
import { projectParticipants } from "../../lib/projection.js";
import { buildMatrix, cluster } from "../../lib/ranking.js";
import type { AggregateState } from "../../ui/hooks.js";
import { displayName } from "../../ui/hooks.js";
import type { DeliberationConfig } from "../../ui/state.js";
import { DEMO_CIRCLE, demoCircleParticipants } from "../demo-circle.js";
import { DEMO_NEXT_MONTH, DEMO_NOW, DEMO_STORIES } from "../demo-stories.js";
import { isQuotable } from "../notebook-data.js";
import { foldCommunityTaps, readPrivateTaps, TAPPED_ANNOTATION } from "../private-tap.js";
import type { V2Route } from "../route.js";
import { gardenSeam, summaryLineSeam } from "../seams.js";
import { type ChangedLine, letterChangedLines } from "../story-data.js";

/** One garden bed: an opinion cluster's soft glow (centroid + spread). */
interface Bed {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/** Project the clusters into garden geometry (pure; no individual points out). */
function gardenBeds(
  participants: readonly string[],
  needIds: readonly string[],
  resonances: Parameters<typeof buildMatrix>[2],
): Bed[] {
  const matrix = buildMatrix(participants, needIds, resonances);
  const clustering = cluster(matrix, 2);
  const points = projectParticipants(matrix, clustering);
  if (points.length === 0) return [];
  const beds: Bed[] = [];
  for (let g = 0; g < clustering.centres.length; g++) {
    const members = points.filter((p) => p.cluster === g);
    if (members.length === 0) continue;
    const cx = members.reduce((s, p) => s + p.x, 0) / members.length;
    const cy = members.reduce((s, p) => s + p.y, 0) / members.length;
    const spread =
      members.length === 1
        ? 0.2
        : Math.sqrt(
            members.reduce((s, p) => s + (p.x - cx) ** 2 + (p.y - cy) ** 2, 0) / members.length,
          );
    // Map [-1,1] opinion space into the 200×120 viewBox with margins.
    beds.push({
      x: 100 + cx * 70,
      y: 60 + cy * 38,
      r: Math.max(14, Math.min(30, 16 + spread * 26)),
    });
  }
  return beds;
}

/**
 * The garden's text equivalent (02 §9) — COUNT-FREE (P8/P11): it names the
 * SHAPE (groups, whether common ground is bridging them), never a tally. A
 * bridge count is still a number, so the copy never renders one — pure so the
 * count-free property is fixture-pinned.
 */
export function gardenText(bedCount: number, bridgeCount: number): string {
  if (bedCount < 2) return "The sky is still gathering — groups appear as people react.";
  return bridgeCount === 0
    ? "Two groups of neighbours read the street differently, with no common ground bridging them yet."
    : "Two groups of neighbours read the street differently, and common ground is starting to bridge them.";
}

/** The garden (constellation form — the 07 §6 default), with text equivalent. */
function Garden({ beds, bridges }: { beds: Bed[]; bridges: Digest["emerged"] }): React.JSX.Element {
  return (
    <div>
      <svg
        className="v2-garden"
        viewBox="0 0 200 120"
        role="img"
        aria-labelledby="garden-desc"
        style={{ maxHeight: "16rem" }}
      >
        <title id="garden-desc">
          The community's shared sky: one soft glow for each way of reading the street, a bridge of
          stars for each thing both groups stand behind.
        </title>
        {beds.map((b, i) => (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: beds are positional geometry
            key={i}
            cx={b.x}
            cy={b.y}
            r={b.r}
            fill={`var(--u-cluster-${i % 4})`}
            opacity={0.18}
          />
        ))}
        {beds.length === 2 &&
          bridges.map((theme, i) => {
            const [a, b] = [beds[0], beds[1]];
            if (!a || !b) return null;
            const t = (i + 1) / (bridges.length + 1);
            const mx = a.x + (b.x - a.x) * t;
            const my = a.y + (b.y - a.y) * t - 8;
            return (
              <g key={theme.statement}>
                <path
                  d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 18} ${b.x} ${b.y}`}
                  fill="none"
                  stroke="var(--u-gold)"
                  strokeWidth="0.8"
                  opacity="0.55"
                />
                <circle cx={mx} cy={my} r="1.6" fill="var(--u-gold)" />
              </g>
            );
          })}
      </svg>
      {/* The text equivalent (02 §9) — same SHAPE as the constellation, and
          COUNT-FREE like it (P8/P11): the garden shows no numbers, so neither
          does its text alternative (a bridge count is still a tally). */}
      <p className="muted small">{gardenText(beds.length, bridges.length)}</p>
      <p className="v2-seam-text">
        {gardenSeam()} <a href="#/how">the long version →</a>
      </p>
    </div>
  );
}

/** The letter (the digest, rendered in the notetaker's voice — 02 §6). */
function Letter({
  digest,
  changedLines,
  tapped,
}: {
  digest: Digest;
  /** Part (c): the fate-trail deltas (v2/story-data — every line linked). */
  changedLines: readonly ChangedLine[];
  /** Statements ≥k people privately tapped (03 §4 — community scale only). */
  tapped: ReadonlySet<string>;
}): React.JSX.Element {
  return (
    <div>
      <div className="v2-letter-section">
        <h3>What emerged</h3>
        {digest.emerged.length === 0 && (
          <p className="muted small">
            Nothing has cleared the bar in every part of the map yet — that is honest, not sad.
          </p>
        )}
        <ul>
          {digest.emerged.map((t) => (
            <li key={t.statement}>
              {t.words !== null ? (
                <>
                  “{t.words}”{" "}
                  {t.authorName !== undefined && (
                    <span className="muted small">— {t.authorName}</span>
                  )}
                </>
              ) : (
                <span className="muted small">
                  A thread both groups stand behind — its words stay with their author until they
                  say otherwise (their call, in their pod).
                </span>
              )}
              {/* The ≥k private-tap annotation (03 §4): count-free, community
                  scale only — below k a statement is simply not in the set. */}
              {tapped.has(t.statement) && <p className="muted small">{TAPPED_ANNOTATION}</p>}
              <p className="v2-seam-text">
                {summaryLineSeam(t.seen, digest.k)} <a href="#/how">the long version →</a>
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* (b) MANDATORY whenever a genuine difference is computed (P7) —
          the same visual warmth as agreement. */}
      <div className="v2-letter-section">
        <h3>Where people genuinely differ</h3>
        {digest.differ.length === 0 ? (
          <p className="muted small">No standing disagreement has taken shape this month.</p>
        ) : (
          <ul>
            {digest.differ.map((t) => (
              <li key={t.statement}>
                {t.words !== null ? (
                  <>“{t.words}”</>
                ) : (
                  <span className="muted small">
                    Two sincere readings of one question — each side's words stay with their
                    authors, and neither was averaged away.
                  </span>
                )}
                <p className="v2-seam-text">
                  {summaryLineSeam(t.seen, digest.k)} <a href="#/how">the long version →</a>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="v2-letter-section">
        <h3>What changed because people spoke</h3>
        {digest.changed.length === 0 && changedLines.length === 0 ? (
          <p className="muted small">
            Nothing has moved outside the conversation yet — when it does, you'll read it here
            first, not in a notification.
          </p>
        ) : (
          <ul>
            {digest.changed.map((line) => (
              <li key={line}>{line}</li>
            ))}
            {changedLines.map((line) => (
              <li key={line.text}>
                {line.text}{" "}
                <a href={line.href} className="small">
                  the whole story →
                </a>
              </li>
            ))}
          </ul>
        )}
        {digest.hasForming && (
          <p className="muted small">Some themes are still forming — they stay uncounted.</p>
        )}
      </div>

      <div className="v2-letter-section">
        <h3>One invitation</h3>
        <p>{digest.invitation}</p>
      </div>
    </div>
  );
}

export function Commons({
  aggregate,
  config,
  onNavigate,
}: {
  aggregate: AggregateState;
  config: DeliberationConfig;
  onNavigate: (r: V2Route) => void;
}): React.JSX.Element {
  const result = aggregate.result;
  const [quotable, setQuotable] = useState<ReadonlySet<string>>(new Set());
  // Statements privately tapped by ≥k distinct people (03 §4) — community
  // scale only; below k the fold returns nothing, so nothing can render.
  const [tapped, setTapped] = useState<ReadonlySet<string>>(new Set());
  // The letter's simulated month (07 §3 V5's monthly-rhythm simulation).
  const [peekNextMonth, setPeekNextMonth] = useState(false);
  const letterNow = peekNextMonth ? DEMO_NEXT_MONTH : DEMO_NOW;

  // The letter's consent gate: which statements may be quoted verbatim
  // (fail-closed — unknown is unquotable). Demo-scale read, keyed to results.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!result) return;
      const demo = await demoForDeliberation(config.deliberation);
      if (!demo) return;
      const ids = new Set<string>();
      for (const c of result.claims) {
        if (await isQuotable(demo.fetch, c.id)) ids.add(c.id);
      }
      const taps = await readPrivateTaps(demo.fetch, demoCircleParticipants(demo));
      if (!cancelled) {
        setQuotable(ids);
        setTapped(foldCommunityTaps(taps));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [result, config.deliberation]);

  const digest = useMemo(() => {
    if (!result) return null;
    const statements: DigestStatement[] = result.claims.map((c) => ({
      id: c.id,
      content: c.content,
      authorName: displayName(c.creator),
      quotable: quotable.has(c.id),
    }));
    return assembleDigest({
      participants: result.verified.map((v) => v.webId),
      needStatements: result.needs.map((n) => n.id),
      resonances: result.resonances,
      statements,
      k: DEFAULT_K_THRESHOLD,
    });
  }, [result, quotable]);

  const beds = useMemo(() => {
    if (!result) return [];
    return gardenBeds(
      result.verified.map((v) => v.webId),
      result.needs.map((n) => n.id),
      result.resonances,
    );
  }, [result]);

  const changedLines = useMemo(() => letterChangedLines(DEMO_STORIES, letterNow), [letterNow]);

  return (
    <section className="view">
      <h2>The commons</h2>
      <p className="muted small">
        A slow picture of what this community is figuring out together. It changes as people talk —
        never as a scoreboard.
      </p>

      <div className="v2-summary">
        <h3>New here?</h3>
        <p className="muted small">
          Take <a href="#/arc">the five-minute walk</a> — a staged neighbourhood, real machinery,
          and the whole loop from saying something to seeing what came of it. Afterwards,{" "}
          <a href="#/curtain">see what was running the whole time</a>.
        </p>
      </div>

      {aggregate.error && <p className="notice error">{aggregate.error}</p>}

      {digest !== null && <Garden beds={beds} bridges={digest.emerged} />}

      <div className="v2-summary">
        <h3>Your circle</h3>
        <p className="muted small">
          {DEMO_CIRCLE.name} is chewing on: <em>{DEMO_CIRCLE.prompt}</em>
        </p>
        <button
          type="button"
          className="v2-chip"
          onClick={() => onNavigate({ view: "circle", id: DEMO_CIRCLE.slug })}
        >
          Join the conversation
        </button>
        <p className="v2-seam-text">
          Curious who meets whom, and why? <a href="#/circles">How circles get put together →</a>
        </p>
      </div>

      <h3 style={{ marginTop: "1.4rem" }}>This month's letter</h3>
      <p className="muted small">
        Written by the notetaker from what people actually said — every line traceable, differences
        carried whole. Reading it counts; there is nothing to keep up with.
      </p>
      <p className="muted small">
        The letter runs on a monthly rhythm — the demo simulates the clock:{" "}
        <button
          type="button"
          className="v2-chip"
          aria-pressed={peekNextMonth}
          onClick={() => setPeekNextMonth((v) => !v)}
        >
          {peekNextMonth ? "back to this month" : "peek at next month"}
        </button>
        {peekNextMonth && (
          <span> — a month on, the scheduled check-in on the crossing falls due.</span>
        )}
      </p>
      {digest !== null ? (
        <Letter digest={digest} changedLines={changedLines} tapped={tapped} />
      ) : (
        <p className="muted">Gathering…</p>
      )}
    </section>
  );
}
