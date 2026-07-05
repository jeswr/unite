// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S3.2 the role-cohort bridging lens. The load-bearing property (design §1.3(b) /
// SCOPE-DIFFERENTIATION §3.4): running the SAME shipped bridging math over the
// VERIFIED-role partition adds real teeth — a synthesis the opinion clusters LOVE
// but the implementer cohort DREADS must NOT clear the combined gate. Also: the
// tiny-cohort-veto mitigation (a sub-threshold role cohort neither endorses nor
// vetoes), and the fail-closed default role for an unmapped participant.

import { describe, expect, it } from "vitest";
import { infraCandidateReception, roleClustering, roleCohortReception } from "./convergence.js";
import { STANCE_CONFLICTS, STANCE_RESONATES } from "./fut.js";
import { ROLE_IMPLEMENTER, type StakeholderRole } from "./fut-draft.js";
import type { Resonance } from "./model.js";

const DELIB = "https://d.example/futures";
const CANDIDATE = "https://d.example/syn/c1#it";
const N1 = "https://d.example/needs/n1#it";
const N2 = "https://d.example/needs/n2#it";

const U = (n: number) => `https://u.example/${n}#me`;
const I = (n: number) => `https://i.example/${n}#me`;

let seq = 0;
function res(creator: string, onStatement: string, stance: string): Resonance {
  seq += 1;
  return {
    id: `https://d.example/res/${seq}#it`,
    creator,
    onStatement,
    stance: stance as Resonance["stance"],
    created: "2026-07-04T00:00:00Z",
    inDeliberation: DELIB,
  };
}

describe("roleClustering — the verified-role partition (fail-closed base)", () => {
  it("partitions participants by verified role, unmapped → base ParticipantRole", () => {
    const participants = [U(1), U(2), I(1)];
    const roleMap = new Map<string, StakeholderRole>([[I(1), ROLE_IMPLEMENTER]]);
    const clust = roleClustering(participants, roleMap);
    // Two cohorts: implementer (I1) + participant (U1,U2 — unmapped default).
    expect(clust.k).toBe(2);
    expect(clust.sizes.reduce((a, b) => a + b, 0)).toBe(3);
    // The implementer cohort has exactly one member; participants two.
    expect([...clust.sizes].sort()).toEqual([1, 2]);
  });

  it("a single role for everyone yields one cohort", () => {
    const clust = roleClustering([U(1), U(2)], new Map());
    expect(clust.k).toBe(1);
    expect(clust.sizes).toEqual([2]);
  });
});

describe("infraCandidateReception — the §3.4 both-partitions gate (the teeth)", () => {
  it("LOVED-by-users, DREADED-by-implementers: opinion endorses, ROLE blocks it", () => {
    // 4 users + 2 implementers. Need votes split users+implementers into TWO mixed
    // opinion clusters (so each opinion cluster leans positive on the candidate —
    // the users outvote the lone implementer). But every implementer CONFLICTS on
    // the candidate → the ROLE partition isolates them into a dissenting cohort.
    const participants = [U(1), U(2), U(3), U(4), I(1), I(2)];
    const roleMap = new Map<string, StakeholderRole>([
      [I(1), ROLE_IMPLEMENTER],
      [I(2), ROLE_IMPLEMENTER],
    ]);
    const resonances: Resonance[] = [
      // Opinion cluster A vector [N1=+1, N2=-1]: U1, U2, I1
      res(U(1), N1, STANCE_RESONATES),
      res(U(1), N2, STANCE_CONFLICTS),
      res(U(2), N1, STANCE_RESONATES),
      res(U(2), N2, STANCE_CONFLICTS),
      res(I(1), N1, STANCE_RESONATES),
      res(I(1), N2, STANCE_CONFLICTS),
      // Opinion cluster B vector [N1=-1, N2=+1]: U3, U4, I2
      res(U(3), N1, STANCE_CONFLICTS),
      res(U(3), N2, STANCE_RESONATES),
      res(U(4), N1, STANCE_CONFLICTS),
      res(U(4), N2, STANCE_RESONATES),
      res(I(2), N1, STANCE_CONFLICTS),
      res(I(2), N2, STANCE_RESONATES),
      // The candidate: ALL users resonate, BOTH implementers conflict.
      res(U(1), CANDIDATE, STANCE_RESONATES),
      res(U(2), CANDIDATE, STANCE_RESONATES),
      res(U(3), CANDIDATE, STANCE_RESONATES),
      res(U(4), CANDIDATE, STANCE_RESONATES),
      res(I(1), CANDIDATE, STANCE_CONFLICTS),
      res(I(2), CANDIDATE, STANCE_CONFLICTS),
    ];
    const result = infraCandidateReception(participants, [N1, N2], resonances, CANDIDATE, roleMap);
    // The OPINION lens alone would ENDORSE (each mixed cluster leans positive)…
    expect(result.opinion.outcome).toBe("endorsed");
    // …but the ROLE lens sees the implementer cohort DREAD it → disagreement…
    expect(result.role.outcome).toBe("disagreement");
    // …so the combined gate is NOT met. This is the whole point of S3.2.
    expect(result.bothCleared).toBe(false);
    expect(result.outcome).toBe("disagreement");
  });

  it("both partitions endorse when every cohort resonates → cleared", () => {
    const participants = [U(1), U(2), U(3), U(4), I(1), I(2)];
    const roleMap = new Map<string, StakeholderRole>([
      [I(1), ROLE_IMPLEMENTER],
      [I(2), ROLE_IMPLEMENTER],
    ]);
    const resonances: Resonance[] = [
      res(U(1), N1, STANCE_RESONATES),
      res(U(1), N2, STANCE_CONFLICTS),
      res(U(2), N1, STANCE_RESONATES),
      res(U(2), N2, STANCE_CONFLICTS),
      res(I(1), N1, STANCE_RESONATES),
      res(I(1), N2, STANCE_CONFLICTS),
      res(U(3), N1, STANCE_CONFLICTS),
      res(U(3), N2, STANCE_RESONATES),
      res(U(4), N1, STANCE_CONFLICTS),
      res(U(4), N2, STANCE_RESONATES),
      res(I(2), N1, STANCE_CONFLICTS),
      res(I(2), N2, STANCE_RESONATES),
      // The candidate: EVERYONE resonates.
      ...participants.map((p) => res(p, CANDIDATE, STANCE_RESONATES)),
    ];
    const result = infraCandidateReception(participants, [N1, N2], resonances, CANDIDATE, roleMap);
    expect(result.opinion.outcome).toBe("endorsed");
    expect(result.role.outcome).toBe("endorsed");
    expect(result.bothCleared).toBe(true);
    expect(result.outcome).toBe("endorsed");
  });

  it("tiny-cohort mitigation: a LONE dissenting implementer cannot veto (open, not disagreement)", () => {
    // One implementer (cohort size 1 < minClusterSize 2) dissents amid resonating
    // users. The role partition must NOT let that single cohort flip the verdict to
    // disagreement — it drops below the threshold and the role lens can only report
    // "open" (insufficient cross-role cohorts), never a veto.
    const participants = [U(1), U(2), U(3), I(1)];
    const roleMap = new Map<string, StakeholderRole>([[I(1), ROLE_IMPLEMENTER]]);
    const resonances: Resonance[] = [
      res(U(1), CANDIDATE, STANCE_RESONATES),
      res(U(2), CANDIDATE, STANCE_RESONATES),
      res(U(3), CANDIDATE, STANCE_RESONATES),
      res(I(1), CANDIDATE, STANCE_CONFLICTS),
    ];
    const role = roleCohortReception(participants, resonances, CANDIDATE, roleMap, {
      minClusterSize: 2,
    });
    // The lone implementer cohort is sub-threshold → not a disagreement (no veto).
    expect(role.outcome).not.toBe("disagreement");
    expect(role.outcome).toBe("open");
  });
});
