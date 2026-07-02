// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The participation-gate seam (Q1). Fail-closed: an unlisted WebID is rejected,
// never defaulted in.

import { describe, expect, it } from "vitest";
import { StubMembershipVerifier } from "./membership.js";

const ALICE = "https://alice.example/#me";
const BOB = "https://bob.example/#me";
const DELIB = "https://community.example/d1";

describe("StubMembershipVerifier", () => {
  it("vouches an allowlisted WebID as tier T1", async () => {
    const v = new StubMembershipVerifier([ALICE]);
    expect(await v.verify(ALICE, DELIB)).toEqual({ ok: true, tier: "T1" });
  });

  it("fail-closed rejects an unlisted WebID", async () => {
    const v = new StubMembershipVerifier([ALICE]);
    const r = await v.verify(BOB, DELIB);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not a vouched member/);
  });

  it("an empty allowlist rejects everyone", async () => {
    const v = new StubMembershipVerifier([]);
    expect((await v.verify(ALICE, DELIB)).ok).toBe(false);
  });
});
