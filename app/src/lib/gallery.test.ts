// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Gallery routing (SCOPE-DIFFERENTIATION §4.4): the contact prior —
// across-the-divide first, then shared-need overlap, never engagement.
// Characterize the ordering, the profile computation, and determinism.

import { describe, expect, it } from "vitest";
import { STANCE_CONFLICTS, STANCE_RESONATES, type Stance } from "./fut.js";
import { needProfile, routeGallery } from "./gallery.js";
import type { Need, Resonance } from "./model.js";
import type { VisionStatement } from "./model-society.js";

const DELIB = "https://community.example/deliberations/society";
const P = [
  "https://p1.example/#me",
  "https://p2.example/#me",
  "https://p3.example/#me",
  "https://p4.example/#me",
];
const FUT = "https://w3id.org/jeswr/sectors/futures#";

let seq = 0;
function vote(creator: string, onStatement: string, stance: Stance): Resonance {
  seq++;
  return {
    id: `https://r.example/g${seq}.ttl`,
    onStatement,
    stance,
    created: "2026-07-01T12:00:00Z",
    creator,
    inDeliberation: DELIB,
  };
}

function need(id: string, creator: string, concept: string): Need {
  return {
    id,
    content: `need ${id}`,
    needConcept: `${FUT}maxneef-${concept}`,
    created: "2026-06-01T00:00:00Z",
    creator,
    inDeliberation: DELIB,
  };
}

function vision(id: string, creator: string, created: string): VisionStatement {
  return { id, content: `vision ${id}`, created, creator, inDeliberation: DELIB };
}

// Needs: n1 (p1, subsistence), n2 (p3, protection), n3 (p4, subsistence).
const N1 = "https://n.example/n1.ttl";
const N2 = "https://n.example/n2.ttl";
const N3 = "https://n.example/n3.ttl";
const needs = [
  need(N1, P[0] as string, "subsistence"),
  need(N2, P[2] as string, "protection"),
  need(N3, P[3] as string, "subsistence"),
];

// Clusters over needs: {p1,p2} resonate n1 / conflict n2; {p3,p4} inverse.
const clusterVotes: Resonance[] = [
  vote(P[0] as string, N1, STANCE_RESONATES),
  vote(P[1] as string, N1, STANCE_RESONATES),
  vote(P[2] as string, N1, STANCE_CONFLICTS),
  vote(P[3] as string, N1, STANCE_CONFLICTS),
  vote(P[0] as string, N2, STANCE_CONFLICTS),
  vote(P[1] as string, N2, STANCE_CONFLICTS),
  vote(P[2] as string, N2, STANCE_RESONATES),
  vote(P[3] as string, N2, STANCE_RESONATES),
  // p4 also endorses the SUBSISTENCE need n3 → p4 shares p1's need profile.
  vote(P[3] as string, N3, STANCE_RESONATES),
];

// Visions: p2 (same cluster as p1), p3 (other cluster, no overlap),
// p4 (other cluster, subsistence overlap), and one by the viewer p1.
const V_OWN = vision("https://v.example/v-own.ttl", P[0] as string, "2026-06-10T00:00:00Z");
const V_SAME = vision("https://v.example/v-same.ttl", P[1] as string, "2026-06-11T00:00:00Z");
const V_FAR = vision("https://v.example/v-far.ttl", P[2] as string, "2026-06-12T00:00:00Z");
const V_BRIDGE = vision("https://v.example/v-bridge.ttl", P[3] as string, "2026-06-13T00:00:00Z");

const options = {
  viewer: P[0] as string,
  participants: P,
  needs,
  visions: [V_OWN, V_SAME, V_FAR, V_BRIDGE],
  resonances: clusterVotes,
};

describe("needProfile", () => {
  it("is the concepts of needs authored PLUS needs positively resonated with", () => {
    // p1 authored n1 (subsistence); resonated n1; conflicted n2 (not counted).
    expect([...needProfile(P[0] as string, needs, clusterVotes)]).toEqual([
      `${FUT}maxneef-subsistence`,
    ]);
    // p4 authored n3 (subsistence) + resonated n2 (protection) + n3.
    expect([...needProfile(P[3] as string, needs, clusterVotes)].sort()).toEqual([
      `${FUT}maxneef-protection`,
      `${FUT}maxneef-subsistence`,
    ]);
  });
});

describe("routeGallery", () => {
  it("excludes the viewer's own visions", () => {
    const ids = routeGallery(options).map((e) => e.vision.id);
    expect(ids).not.toContain(V_OWN.id);
  });

  it("routes across-the-divide first, then by shared-need overlap", () => {
    const entries = routeGallery(options);
    // p4: other cluster + shares subsistence → first.
    // p3: other cluster, no overlap → second.
    // p2: same cluster → last.
    expect(entries.map((e) => e.vision.id)).toEqual([V_BRIDGE.id, V_FAR.id, V_SAME.id]);
    expect(entries[0]?.acrossTheDivide).toBe(true);
    expect(entries[0]?.sharedNeedConcepts).toEqual([`${FUT}maxneef-subsistence`]);
    expect(entries[2]?.acrossTheDivide).toBe(false);
  });

  it("is invariant to input ordering (fully deterministic)", () => {
    const shuffled = {
      ...options,
      visions: [...options.visions].reverse(),
      resonances: [...options.resonances].reverse(),
      participants: [...options.participants].reverse(),
    };
    expect(routeGallery(shuffled)).toEqual(routeGallery(options));
  });

  it("an unclustered viewer still gets an overlap-led order, never a throw", () => {
    const entries = routeGallery({ ...options, viewer: "https://newcomer.example/#me" });
    expect(entries).toHaveLength(4); // all visions (none are the newcomer's)
    for (const e of entries) expect(e.acrossTheDivide).toBe(false);
  });

  it("newest-first breaks ties within a band", () => {
    // Same cluster band (p2's vision) alone — add a second same-cluster vision.
    const v2 = vision("https://v.example/v-same2.ttl", P[1] as string, "2026-06-20T00:00:00Z");
    const entries = routeGallery({ ...options, visions: [...options.visions, v2] });
    const sameBand = entries.filter((e) => e.vision.creator === P[1]);
    expect(sameBand.map((e) => e.vision.id)).toEqual([v2.id, V_SAME.id]);
  });
});
