// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// #/curtain — "SEE WHAT WAS RUNNING THE WHOLE TIME" (design/v2 06 §5): the
// thirty-minute pass. The visitor's own session replayed next to the engine
// state it produced — the reveal test performed as theater. Everything on
// this page is recomputed live from the same demo pods the conversation
// wrote (nothing here is a log; there is no log):
//
//   • their utterances → the drafter's atoms (draftMirror re-run — it is
//     deterministic, so the replay IS the original) → the adoption events,
//     PROV chain rendered;
//   • their reactions → the literal resonance-matrix row appearing;
//   • the REAL map with their dot placed — "only you can see yours";
//   • the deck's routing table for their next beat (the literal fields);
//   • the room's computed reception per candidate, dissent annex assembling;
//   • the pod inspector: every resource the session wrote, deletable — with
//     the engine state above recomputing live when one goes.
//
// Nothing on this page should surprise a visitor who read the handshake —
// that is the point, and the page says so.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { demoForDeliberation } from "../../demo/pods.js";
import { candidateReception, standingCritiques } from "../../lib/convergence.js";
import { routeDeck } from "../../lib/deck.js";
import { draftMirror } from "../../lib/mirror-draft.js";
import { listContainer } from "../../lib/pod.js";
import { projectParticipants } from "../../lib/projection.js";
import { buildMatrix, cluster } from "../../lib/ranking.js";
import { SURFACES, surfaceHref } from "../../scope/surface.js";
import type { AggregateState } from "../../ui/hooks.js";
import { displayName } from "../../ui/hooks.js";
import { type DeliberationConfig, sessionIdentity } from "../../ui/state.js";
import { type CircleMessage, readCircleMessages } from "../circle-data.js";
import { DEMO_CIRCLE } from "../demo-circle.js";
import { deleteOwnResource, type OwnStatements, readOwnStatements } from "../notebook-data.js";

/** The pod containers the session writes into (the inspector's sweep). */
const INSPECTED_DIRS = [
  "circle-messages",
  "claims",
  "needs",
  "values",
  "resonances",
  "activities",
  "consents",
  "private-taps",
] as const;

function Cell({ v }: { v: number | null }): React.JSX.Element {
  return <td className="v2-matrix-cell">{v === null ? "—" : v}</td>;
}

export function Curtain({
  aggregate,
  config,
}: {
  aggregate: AggregateState;
  config: DeliberationConfig;
}): React.JSX.Element {
  const identity = sessionIdentity(config, null);
  const [ownWords, setOwnWords] = useState<readonly CircleMessage[]>([]);
  const [own, setOwn] = useState<OwnStatements | null>(null);
  const [inventory, setInventory] = useState<ReadonlyArray<{ dir: string; url: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Unmount guard: the demo-pod reads are async; a state set after unmount
  // (test teardown, quick navigation) must be a no-op.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const demo = await demoForDeliberation(config.deliberation);
      if (!demo) throw new Error("the curtain opens on the demo deliberation");
      const words = await readCircleMessages(demo.fetch, [demo.you], DEMO_CIRCLE.id);
      const statements = await readOwnStatements(demo.fetch, demo.you.base);
      const found: { dir: string; url: string }[] = [];
      for (const dir of INSPECTED_DIRS) {
        try {
          const members = await listContainer(
            demo.fetch,
            new URL(`${dir}/`, demo.you.base).toString(),
          );
          for (const url of members) found.push({ dir, url });
        } catch {
          // an empty/absent container lists as nothing — fail-isolated
        }
      }
      if (!mounted.current) return;
      setOwnWords(words);
      setOwn(statements);
      setInventory(found);
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [config.deliberation]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function remove(url: string): Promise<void> {
    setBusy(true);
    try {
      const demo = await demoForDeliberation(config.deliberation);
      if (!demo) return;
      await deleteOwnResource(demo.fetch, demo.you.base, url);
      await refresh();
      await aggregate.refresh(); // the engine state above recomputes LIVE
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  const result = aggregate.result;

  // The community opinion space — the SAME calls every surface makes.
  const engine = useMemo(() => {
    if (!result || !identity) return null;
    const participants = result.verified.map((v) => v.webId);
    const needIds = result.needs.map((n) => n.id);
    const matrix = buildMatrix(participants, needIds, result.resonances);
    const clustering = cluster(matrix, 2);
    const points = projectParticipants(matrix, clustering);
    const viewerRow = matrix.participants.indexOf(identity);
    const deck = routeDeck({
      viewer: identity,
      participants,
      needStatements: needIds,
      deckStatements: result.claims.filter((c) => c.creator !== identity).map((c) => c.id),
      resonances: result.resonances,
    });
    return { participants, needIds, matrix, clustering, points, viewerRow, deck };
  }, [result, identity]);

  const statementWords = useMemo(() => {
    const m = new Map<string, string>();
    if (!result) return m;
    for (const s of [...result.claims, ...result.needs, ...result.values]) m.set(s.id, s.content);
    return m;
  }, [result]);

  const loc = typeof window === "undefined" ? null : window.location;
  const v1 = (hash: string) => surfaceHref("v1", loc?.search, hash, SURFACES.v2.forcesScope);

  return (
    <section className="view">
      <h2>What was running the whole time</h2>
      <p className="muted small">
        Your session, replayed next to the engine state it produced — computed fresh from the pods,
        right now, because there is nowhere else it could come from. If anything on this page feels
        like a betrayal of the conversation you just had, we've failed — tell us which part.
      </p>
      {error && <p className="notice error">{error}</p>}

      {/* 1 — utterance → atoms → adoption (the PROV chain). */}
      <div className="v2-letter-section">
        <h3>Your words → the drafter's atoms → what you adopted</h3>
        {ownWords.length === 0 ? (
          <p className="muted small">
            You haven't said anything yet — go talk in{" "}
            <a href={`#/circle/${DEMO_CIRCLE.slug}`}>your circle</a> and this section fills in.
          </p>
        ) : (
          <ul>
            {ownWords.map((m) => {
              const draft = draftMirror(m.content);
              return (
                <li key={m.id}>
                  “{m.content}”
                  <p className="muted small">
                    the drafter's reading (re-run now — it is deterministic, so this replay IS what
                    ran): outcome <code>{draft.kind}</code>
                    {draft.kind === "draft" && (
                      <>
                        {" "}
                        → atoms:{" "}
                        {draft.atoms
                          .map((a) => `${a.kind}: “${a.content.slice(0, 60)}”`)
                          .join(" · ")}
                      </>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {own !== null && own.claims.length > 0 && (
          <>
            <p className="muted small">Adopted — the PROV chain on each:</p>
            <ul>
              {own.claims.map((c) => (
                <li key={c.id}>
                  “{c.content}”
                  <p className="v2-seam-text">
                    adoptedBy = creator = you (the invariant a forged adoption cannot be written
                    past){c.derivedFrom !== undefined && <> · prov:wasDerivedFrom → your message</>}
                    {c.decomposedBy !== undefined && (
                      <> · fut:decomposedBy → the drafter's recorded activity</>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* 2 — reactions → the matrix row. */}
      <div className="v2-letter-section">
        <h3>Your reactions → your row in the matrix</h3>
        {engine === null || engine.viewerRow < 0 ? (
          <p className="muted small">No row yet — react to something and it appears.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="v2-matrix" aria-label="your resonance-matrix row">
              <tbody>
                <tr>
                  <th scope="row" className="muted small">
                    you
                  </th>
                  {(engine.matrix.rows[engine.viewerRow] ?? []).map((v, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: matrix columns are positional
                    <Cell key={j} v={v} />
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="v2-seam-text">
              1 = resonates, -1 = I see it differently, 0 = not sure, — = unseen. This row is the
              entirety of what the clustering knows about you.
            </p>
          </div>
        )}
      </div>

      {/* 3 — the real map, your dot placed. */}
      <div className="v2-letter-section">
        <h3>The map, with your dot</h3>
        {engine === null || engine.points.length === 0 ? (
          <p className="muted small">The map draws once reactions exist.</p>
        ) : (
          <>
            <svg
              viewBox="0 0 200 120"
              role="img"
              aria-labelledby="curtain-map-desc"
              style={{ maxHeight: "14rem", width: "100%" }}
            >
              <title id="curtain-map-desc">
                The real opinion map: one dot per participant, coloured by cluster; your own dot
                ringed — visible only to you.
              </title>
              {engine.points.map((p) => (
                <circle
                  key={p.participant}
                  cx={100 + p.x * 70}
                  cy={60 + p.y * 38}
                  r={p.participant === identity ? 4 : 2.5}
                  fill={`var(--u-cluster-${p.cluster % 4})`}
                  stroke={p.participant === identity ? "var(--u-gold)" : "none"}
                  strokeWidth={p.participant === identity ? 1.5 : 0}
                />
              ))}
            </svg>
            <p className="muted small">
              {engine.viewerRow >= 0
                ? "The ringed dot is you — only you can see yours. Nobody else's surface marks anyone."
                : "You are not on the map yet — react to something and your dot appears, to you only."}
            </p>
          </>
        )}
      </div>

      {/* 4 — the deck's routing table (the literal fields). */}
      <div className="v2-letter-section">
        <h3>The router's next beats for you — the literal fields</h3>
        {engine === null || engine.deck.length === 0 ? (
          <p className="muted small">The deck is empty for you right now.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="v2-matrix" aria-label="the deck routing table">
              <thead>
                <tr>
                  <th>statement</th>
                  <th>ownClusterSeen</th>
                  <th>neighbourResonance</th>
                  <th>totalSeen</th>
                </tr>
              </thead>
              <tbody>
                {engine.deck.slice(0, 4).map((d) => (
                  <tr key={d.statement}>
                    <td className="small">
                      {statementWords.get(d.statement)?.slice(0, 60) ?? d.statement}
                    </td>
                    <td className="v2-matrix-cell">{d.ownClusterSeen}</td>
                    <td className="v2-matrix-cell">{d.neighbourResonance.toFixed(3)}</td>
                    <td className="v2-matrix-cell">{d.totalSeen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="v2-seam-text">
              These are the exact fields the "why this one?" seam restates in the circle.
            </p>
          </div>
        )}
      </div>

      {/* 5 — the room's computed reception, dissent annex assembling. */}
      <div className="v2-letter-section">
        <h3>The room's computed reception</h3>
        {!result || !engine || result.candidates.length === 0 ? (
          <p className="muted small">No candidate statements in this deliberation yet.</p>
        ) : (
          <ul>
            {result.candidates.map((cand) => {
              const reception = candidateReception(
                engine.participants,
                engine.needIds,
                result.resonances,
                cand.id,
              );
              const critiques = standingCritiques(result.critiques, cand.id);
              return (
                <li key={cand.id}>
                  <strong>{cand.title ?? cand.content.slice(0, 48)}</strong>
                  <p className="muted small">
                    computed outcome: <code>{reception.outcome}</code> · votes seen:{" "}
                    {reception.totalSeen} — computed from votes, never asserted.
                  </p>
                  {critiques.length > 0 && (
                    <p className="muted small">
                      dissent annex assembling — {critiques.length === 1 ? "one" : "the"} standing
                      critique{critiques.length === 1 ? "" : "s"}:{" "}
                      {critiques.map((cr) => `“${cr.content.slice(0, 70)}…”`).join(" · ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 6 — the pod inspector: delete and watch everything recompute. */}
      <div className="v2-letter-section">
        <h3>Your pod, resource by resource</h3>
        <p className="muted small">
          Every resource this session wrote, at its real address. Delete one and the sections above
          recompute without it — there is no other copy to catch up.
        </p>
        {inventory.length === 0 ? (
          <p className="muted small">Nothing written yet.</p>
        ) : (
          <ul>
            {inventory.map((r) => (
              <li key={r.url} className="small">
                <code className="small">{r.url}</code>{" "}
                <button
                  type="button"
                  className="v2-chip"
                  disabled={busy}
                  onClick={() => void remove(r.url)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="v2-letter-section">
        <h3>The instruments, undressed</h3>
        <p className="muted small">
          The v1 surface shows all of this as instruments, numbers on — same session, same pods,
          same engine. This is also where the v1↔v2 side-by-side comparison lives:{" "}
          <a href={v1("#/board")}>the needs board</a> · <a href={v1("#/bridge")}>the opinion map</a>{" "}
          · <a href={v1("#/room")}>the convergence room</a> ·{" "}
          <a href={v1("#/deck")}>the resonance deck</a>. Community names:{" "}
          {result?.verified
            .slice(0, 3)
            .map((v) => displayName(v.webId))
            .join(", ")}
          …
        </p>
      </div>
    </section>
  );
}
