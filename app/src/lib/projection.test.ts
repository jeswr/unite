// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The opinion-map projection is deterministic PCA: same votes → same map,
// separated voting blocs land apart on PC1, and degenerate inputs are safe.

import { describe, expect, it } from "vitest";
import { STANCE_CONFLICTS, STANCE_RESONATES } from "./fut.js";
import type { Resonance } from "./model.js";
import { projectParticipants } from "./projection.js";
import { buildMatrix, cluster } from "./ranking.js";

const S = (n: number) => `https://s.example/statements/${n}`;
const P = (name: string) => `https://p.example/${name}#me`;

function vote(creator: string, statement: string, stance: string, n: number): Resonance {
  return {
    id: `https://p.example/re/${creator.length}-${n}`,
    onStatement: statement,
    stance: stance as Resonance["stance"],
    created: "2026-06-01T00:00:00Z",
    creator,
    inDeliberation: "https://d.example/d",
  };
}

/** Two opposed blocs: A-people resonate with s1/s2 and reject s3/s4; B inverts. */
function blocMatrix() {
  const participants = [P("a1"), P("a2"), P("a3"), P("b1"), P("b2"), P("b3")];
  const statements = [S(1), S(2), S(3), S(4)];
  const votes: Resonance[] = [];
  let n = 0;
  for (const a of [P("a1"), P("a2"), P("a3")]) {
    votes.push(vote(a, S(1), STANCE_RESONATES, n++), vote(a, S(2), STANCE_RESONATES, n++));
    votes.push(vote(a, S(3), STANCE_CONFLICTS, n++), vote(a, S(4), STANCE_CONFLICTS, n++));
  }
  for (const b of [P("b1"), P("b2"), P("b3")]) {
    votes.push(vote(b, S(1), STANCE_CONFLICTS, n++), vote(b, S(2), STANCE_CONFLICTS, n++));
    votes.push(vote(b, S(3), STANCE_RESONATES, n++), vote(b, S(4), STANCE_RESONATES, n++));
  }
  return buildMatrix(participants, statements, votes);
}

describe("projectParticipants", () => {
  it("is deterministic (same input → identical output)", () => {
    const m = blocMatrix();
    const c = cluster(m, 2);
    expect(projectParticipants(m, c)).toEqual(projectParticipants(m, c));
  });

  it("separates opposed voting blocs on the first axis and tags their clusters", () => {
    const m = blocMatrix();
    const c = cluster(m, 2);
    const pts = projectParticipants(m, c);
    expect(pts).toHaveLength(6);
    const aXs = pts.filter((p) => p.participant.includes("/a")).map((p) => p.x);
    const bXs = pts.filter((p) => p.participant.includes("/b")).map((p) => p.x);
    // The blocs must land on opposite sides of the origin.
    const aSide = Math.sign(aXs[0] ?? 0);
    expect(aSide).not.toBe(0);
    for (const x of aXs) expect(Math.sign(x)).toBe(aSide);
    for (const x of bXs) expect(Math.sign(x)).toBe(-aSide);
    // Cluster tags match the shared clustering (one cluster per bloc).
    const aClusters = new Set(
      pts.filter((p) => p.participant.includes("/a")).map((p) => p.cluster),
    );
    const bClusters = new Set(
      pts.filter((p) => p.participant.includes("/b")).map((p) => p.cluster),
    );
    expect(aClusters.size).toBe(1);
    expect(bClusters.size).toBe(1);
    expect([...aClusters][0]).not.toBe([...bClusters][0]);
  });

  it("stays within the normalised range", () => {
    const m = blocMatrix();
    const pts = projectParticipants(m, cluster(m, 2));
    for (const p of pts) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1.1); // small spread allowance
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1.1);
    }
  });

  it("spreads exactly-coincident participants so none is hidden", () => {
    // Identical votes → identical projection → the spread ring separates them.
    const participants = [P("x1"), P("x2"), P("x3")];
    const statements = [S(1)];
    const votes = participants.map((p, i) => vote(p, S(1), STANCE_RESONATES, i));
    const m = buildMatrix(participants, statements, votes);
    const pts = projectParticipants(m, cluster(m, 1));
    const keys = new Set(pts.map((p) => `${p.x.toFixed(4)}|${p.y.toFixed(4)}`));
    expect(keys.size).toBe(3);
  });

  it("handles empty + degenerate inputs safely", () => {
    const empty = buildMatrix([], [], []);
    expect(projectParticipants(empty, cluster(empty, 2))).toEqual([]);
    const noStatements = buildMatrix([P("a")], [], []);
    const pts = projectParticipants(noStatements, cluster(noStatements, 2));
    expect(pts).toEqual([{ participant: P("a"), x: 0, y: 0, cluster: 0 }]);
  });
});
