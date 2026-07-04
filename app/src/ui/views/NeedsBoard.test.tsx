// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The board's reaction tallies: counts per statement, the viewer's own stance
// marked, deduped input trusted as-is (dedupe lives in aggregate.ts).

import { describe, expect, it } from "vitest";
import { STANCE_CONFLICTS, STANCE_RESONATES, STANCE_UNSURE } from "../../lib/fut.js";
import type { Resonance } from "../../lib/model.js";
import { tallyResonances } from "./NeedsBoard.js";

const S1 = "https://s.example/1";
const S2 = "https://s.example/2";
const ME = "https://me.example/#me";

const re = (
  creator: string,
  onStatement: string,
  stance: Resonance["stance"],
  n: number,
): Resonance => ({
  id: `https://r.example/${n}`,
  onStatement,
  stance,
  created: "2026-06-01T00:00:00Z",
  creator,
  inDeliberation: "https://d.example/d",
});

describe("tallyResonances", () => {
  it("counts per statement per stance", () => {
    const t = tallyResonances(
      [
        re("https://a/#me", S1, STANCE_RESONATES, 1),
        re("https://b/#me", S1, STANCE_RESONATES, 2),
        re("https://c/#me", S1, STANCE_CONFLICTS, 3),
        re("https://d/#me", S1, STANCE_UNSURE, 4),
        re("https://a/#me", S2, STANCE_CONFLICTS, 5),
      ],
      null,
    );
    expect(t.get(S1)).toMatchObject({ resonates: 2, conflicts: 1, unsure: 1 });
    expect(t.get(S2)).toMatchObject({ resonates: 0, conflicts: 1, unsure: 0 });
    expect(t.get(S1)?.yours).toBeUndefined();
  });

  it("marks the viewer's own stance", () => {
    const t = tallyResonances(
      [re(ME, S1, STANCE_CONFLICTS, 1), re("https://a/#me", S1, STANCE_RESONATES, 2)],
      ME,
    );
    expect(t.get(S1)?.yours).toBe(STANCE_CONFLICTS);
  });

  it("is empty for no resonances", () => {
    expect(tallyResonances([], ME).size).toBe(0);
  });
});
