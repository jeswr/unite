// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The letter assembler — V2's fixture rows (design/v2 07 §3/§5):
//   • the four-part structure always present;
//   • the differ-block MANDATORY when reception is divisive (P7);
//   • the k-threshold floor: no sub-k characterization ever renders, and the
//     forming signal is COUNT-FREE (P11);
//   • quotes only under fut:quoteVerbatim consent;
//   • deterministic.

import { describe, expect, it } from "vitest";
import { assembleDigest, DEFAULT_INVITATION, type DigestStatement } from "./digest.js";
import { STANCE_CONFLICTS, STANCE_RESONATES } from "./fut.js";
import type { Resonance } from "./model.js";

const DELIB = "https://demo.unite.example/deliberations/society";
const P = (n: number) => `https://p.example/${n}#me`;
// Two crafted opinion clusters over two needs: A (p1–p4) loves n1/rejects n2;
// B (p5–p8) the reverse.
const PARTICIPANTS = [1, 2, 3, 4, 5, 6, 7, 8].map(P);
const N1 = "https://s.example/needs/n1";
const N2 = "https://s.example/needs/n2";

const S_COMMON = "https://s.example/claims/common";
const S_DIVISIVE = "https://s.example/claims/divisive";
const S_THIN = "https://s.example/claims/thin";

let seq = 0;
function vote(creator: string, on: string, stance: string): Resonance {
  seq += 1;
  return {
    id: `https://r.example/${seq}`,
    onStatement: on,
    stance: stance as Resonance["stance"],
    created: "2026-06-20T00:00:00Z",
    creator,
    inDeliberation: DELIB,
  };
}

function craftedResonances(): Resonance[] {
  const out: Resonance[] = [];
  for (const i of [1, 2, 3, 4]) {
    out.push(vote(P(i), N1, STANCE_RESONATES), vote(P(i), N2, STANCE_CONFLICTS));
  }
  for (const i of [5, 6, 7, 8]) {
    out.push(vote(P(i), N1, STANCE_CONFLICTS), vote(P(i), N2, STANCE_RESONATES));
  }
  // s-common: both clusters lean positive, 6 votes (≥ k).
  for (const i of [1, 2, 3, 5, 6, 7]) out.push(vote(P(i), S_COMMON, STANCE_RESONATES));
  // s-divisive: A positive, B negative, 6 votes (≥ k).
  for (const i of [1, 2, 3]) out.push(vote(P(i), S_DIVISIVE, STANCE_RESONATES));
  for (const i of [5, 6, 7]) out.push(vote(P(i), S_DIVISIVE, STANCE_CONFLICTS));
  // s-thin: positive everywhere but only 2 votes — BELOW the k floor.
  out.push(vote(P(1), S_THIN, STANCE_RESONATES), vote(P(5), S_THIN, STANCE_RESONATES));
  return out;
}

const STATEMENTS: DigestStatement[] = [
  { id: S_COMMON, content: "Kids on bikes, not brakes.", authorName: "Farah", quotable: true },
  {
    id: S_DIVISIVE,
    content: "Ban through-traffic entirely.",
    authorName: "Chidi",
    quotable: false,
  },
  { id: S_THIN, content: "A bench on every corner.", authorName: "Gus", quotable: true },
];

function assemble() {
  return assembleDigest({
    participants: PARTICIPANTS,
    needStatements: [N1, N2],
    resonances: craftedResonances(),
    statements: STATEMENTS,
  });
}

describe("assembleDigest", () => {
  it("emits the four-part structure with the mandatory differ block (P7)", () => {
    const d = assemble();
    expect(d.emerged.map((t) => t.statement)).toEqual([S_COMMON]);
    // MANDATORY: reception is divisive → the differ section is non-empty.
    expect(d.differ.map((t) => t.statement)).toEqual([S_DIVISIVE]);
    expect(d.changed).toEqual([]);
    expect(d.invitation).toBe(DEFAULT_INVITATION);
  });

  it("enforces the k floor: a sub-k statement is NEVER characterized (P11)", () => {
    const d = assemble();
    expect(d.emerged.some((t) => t.statement === S_THIN)).toBe(false);
    expect(d.differ.some((t) => t.statement === S_THIN)).toBe(false);
    // …and the forming signal is COUNT-FREE: a boolean, not a number.
    expect(d.hasForming).toBe(true);
    expect(d.k).toBe(5);
  });

  it("quotes verbatim ONLY under consent (fail-closed words)", () => {
    const d = assemble();
    const common = d.emerged[0];
    const divisive = d.differ[0];
    expect(common?.words).toBe("Kids on bikes, not brakes.");
    expect(common?.authorName).toBe("Farah");
    expect(divisive?.words).toBeNull(); // not quotable — theme without the words
  });

  it("characterized themes always carry ≥ k community votes", () => {
    const d = assemble();
    for (const t of [...d.emerged, ...d.differ]) {
      expect(t.seen).toBeGreaterThanOrEqual(d.k);
    }
  });

  it("is deterministic (same inputs, same digest)", () => {
    expect(assemble()).toEqual(assemble());
  });

  it("with no votes at all: nothing characterized, everything forming", () => {
    const d = assembleDigest({
      participants: PARTICIPANTS,
      needStatements: [N1, N2],
      resonances: [],
      statements: STATEMENTS,
      changed: ["The crossing petition went to the council."],
      invitation: "Bring one neighbour.",
    });
    expect(d.emerged).toEqual([]);
    expect(d.differ).toEqual([]);
    expect(d.hasForming).toBe(true);
    expect(d.changed).toEqual(["The crossing petition went to the council."]);
    expect(d.invitation).toBe("Bring one neighbour.");
  });
});
