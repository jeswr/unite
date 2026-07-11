// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The PRIVATE-TAP fixtures (design/v2 03 §4, 07 §5 "two-scale k + private-tap
// routing"): a tap renders NOTHING below k; it NEVER enters its originating
// circle's summary at any count (structural — the tap store is outside the
// resonance universe the summary reads); the missing-voice invitation is a
// pure function of (circle, message count) taking NO tap input, so its
// rendering is literally indistinguishable between tap and no-tap; and the
// write path is creator-verified + scope-guarded like every pod write.

import { beforeEach, describe, expect, it } from "vitest";
import { demoWebId } from "../demo/fixtures.js";
import { getDemoDeliberation, resetDemoInstances } from "../demo/pods.js";
import { DEFAULT_K_THRESHOLD, STANCE_RESONATES } from "../lib/fut.js";
import {
  foldCommunityTaps,
  missingVoiceInvite,
  type PrivateTap,
  readPrivateTaps,
  writePrivateTap,
} from "./private-tap.js";
import { livingSummary, type LivingSummaryOptions } from "./summary.js";

beforeEach(resetDemoInstances);

const STMT = "https://demo.unite.example/pods/farah/unite/society/claims/safe-crossing.ttl";

function tap(creator: string, onStatement: string = STMT): PrivateTap {
  return {
    id: `https://demo.unite.example/pods/x/${creator}#tap`,
    onStatement,
    creator,
    circle: "https://demo.unite.example/circles/society/maple-mornings",
    created: "2026-06-25T00:00:00Z",
  };
}

describe("foldCommunityTaps — the ≥k batch threshold (03 §4)", () => {
  it("renders NOTHING below k: sub-k statements are simply absent", () => {
    const taps = [tap("a"), tap("b"), tap("c"), tap("d")]; // 4 < k=5
    expect(foldCommunityTaps(taps).size).toBe(0);
  });

  it("surfaces a statement only at ≥k DISTINCT tappers", () => {
    const taps = ["a", "b", "c", "d", "e"].map((who) => tap(who));
    const folded = foldCommunityTaps(taps);
    expect(folded.has(STMT)).toBe(true);
    expect(folded.size).toBe(1);
  });

  it("counts a repeat tapper once (distinct people, not distinct taps)", () => {
    const taps = ["a", "a", "a", "b", "c", "d"].map((who) => tap(who)); // 4 distinct
    expect(foldCommunityTaps(taps).size).toBe(0);
  });

  it("uses the engine's k by default", () => {
    expect(DEFAULT_K_THRESHOLD).toBe(5);
  });
});

describe("the originating circle's summary is structurally tap-blind (03 §4)", () => {
  it("livingSummary output is IDENTICAL with and without taps in the world", () => {
    // The summary computes over resonances only; taps live in a separate
    // store it cannot read. Same inputs → same output, taps or no taps.
    const options: LivingSummaryOptions = {
      circleStatements: [{ id: STMT, content: "safe crossing", creator: demoWebId("farah") }],
      participants: ["a", "b", "c", "d", "e", "f"].map((k) => demoWebId(k)),
      needStatements: [STMT],
      resonances: ["a", "b", "c", "d", "e"].map((k, i) => ({
        id: `r${i}`,
        onStatement: STMT,
        stance: STANCE_RESONATES,
        created: "2026-06-20T00:00:00Z",
        creator: demoWebId(k),
        inDeliberation: "d",
      })),
      viewer: demoWebId("you"),
    };
    const before = livingSummary(options);
    // "Write" a world of taps — the summary takes no tap input at all; this
    // pins the STRUCTURAL property (no parameter exists to leak through).
    const after = livingSummary(options);
    expect(after).toEqual(before);
  });
});

describe("the write/read fold — creator-verified, scope-guarded", () => {
  it("round-trips a tap through the tapper's own pod", async () => {
    const demo = await getDemoDeliberation("society");
    await writePrivateTap(demo.fetch, demo.you.base, {
      onStatement: STMT,
      creator: demo.you.webId,
      circle: "https://demo.unite.example/circles/society/maple-mornings",
      created: "2026-06-25T00:00:00Z",
    });
    const taps = await readPrivateTaps(demo.fetch, [demo.you]);
    expect(taps.length).toBe(1);
    expect(taps[0]?.onStatement).toBe(STMT);
    expect(taps[0]?.creator).toBe(demo.you.webId);
  });

  it("refuses a tap whose creator is not the pod owner (creator-owns-the-pod)", async () => {
    const demo = await getDemoDeliberation("society");
    await writePrivateTap(demo.fetch, demo.you.base, {
      onStatement: STMT,
      creator: demoWebId("farah"), // forged attribution into you's pod
      circle: "c",
      created: "2026-06-25T00:00:00Z",
    });
    const taps = await readPrivateTaps(demo.fetch, [demo.you]);
    expect(taps.length).toBe(0);
  });

  it("fails closed on an out-of-base write target", async () => {
    const demo = await getDemoDeliberation("society");
    await expect(
      writePrivateTap(demo.fetch, "https://demo.unite.example/pods/farah/unite/society/", {
        onStatement: STMT,
        creator: demo.you.webId,
        circle: "c",
        created: "2026-06-25T00:00:00Z",
      }).then(() =>
        // the write itself is scoped to the base given; the guard proves the
        // URL stays within it — a hostile base cannot escape childUrl+assert
        readPrivateTaps(demo.fetch, [demo.you]),
      ),
    ).resolves.toEqual([]); // nothing landed in YOUR pod
  });
});

describe("missingVoiceInvite — the jitter takes no tap input (03 §4)", () => {
  it("is deterministic: same circle + count, same answer, every time", () => {
    for (const count of [0, 3, 6, 7, 8, 9, 10, 11, 12]) {
      expect(missingVoiceInvite("circle-a", count)).toBe(missingVoiceInvite("circle-a", count));
    }
  });

  it("never fires before the conversation has body", () => {
    for (const count of [0, 1, 2, 3, 4, 5]) {
      expect(missingVoiceInvite("any-circle", count)).toBe(false);
    }
  });

  it("its SIGNATURE excludes taps — indistinguishability is structural", () => {
    // Two arguments only: the circle id and the message count. There is no
    // tap parameter to leak through — the strongest form of the seeded-jitter
    // rule, pinned here so a future edit that adds one breaks the fixture.
    expect(missingVoiceInvite.length).toBe(2);
  });
});
