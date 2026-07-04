// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The config modes: every scope's default is its OWN seeded demo deliberation
// (segmented by scope id — the resolved scope drives the data layer, not just
// chrome), pod mode starts empty + fail-closed, and the seam constructors
// accept every demo default.

import { describe, expect, it } from "vitest";
import { demoDeliberationIri, demoWebId } from "../demo/fixtures.js";
import { SCOPE_ORDER, SCOPES } from "../scope/scopes.js";
import {
  buildRegistry,
  buildVerifier,
  configReady,
  podConfig,
  scopedDefaultConfig,
  sessionIdentity,
} from "./state.js";

describe("scopedDefaultConfig (demo mode)", () => {
  it("gives each scope a distinct demo deliberation + container, segmented by scope id", () => {
    const configs = SCOPE_ORDER.map((id) => scopedDefaultConfig(SCOPES[id]));
    for (const [i, id] of SCOPE_ORDER.entries()) {
      const c = configs[i];
      expect(c?.mode).toBe("demo");
      expect(c?.deliberation).toBe(demoDeliberationIri(id));
      expect(c?.ownBase).toContain(`/unite/${id}/`);
      expect(c?.participants.some((p) => p.base === c?.ownBase)).toBe(true);
    }
    expect(new Set(configs.map((c) => c?.deliberation)).size).toBe(SCOPE_ORDER.length);
    expect(new Set(configs.map((c) => c?.ownBase)).size).toBe(SCOPE_ORDER.length);
  });

  it("every scoped demo default is accepted by the registry + verifier constructors", () => {
    for (const id of SCOPE_ORDER) {
      const config = scopedDefaultConfig(SCOPES[id]);
      expect(() => buildRegistry(config)).not.toThrow();
      expect(() => buildVerifier(config)).not.toThrow();
    }
  });

  it("demo configs are always ready to aggregate", () => {
    for (const id of SCOPE_ORDER) {
      expect(configReady(scopedDefaultConfig(SCOPES[id]))).toBe(true);
    }
  });
});

describe("podConfig (fail-closed until configured)", () => {
  it("starts empty and NOT ready — no requests fire from a blank form", () => {
    const c = podConfig();
    expect(c.mode).toBe("pod");
    expect(c.participants).toEqual([]);
    expect(configReady(c)).toBe(false);
  });

  it("becomes ready only with a valid deliberation IRI + valid participants", () => {
    const base = { ...podConfig(), deliberation: "https://community.example/d" };
    expect(configReady(base)).toBe(false); // no participants
    expect(
      configReady({
        ...base,
        participants: [{ webId: "https://a.example/#me", base: "https://a.example/unite/d/" }],
      }),
    ).toBe(true);
    // An invalid participant keeps the whole config not-ready (fail-closed).
    expect(
      configReady({
        ...base,
        participants: [
          { webId: "https://a.example/#me", base: "https://a.example/unite/d/" },
          { webId: "https://b.example/#me", base: "http://b.example/unite/d/" }, // http base
        ],
      }),
    ).toBe(false);
    expect(configReady({ ...base, deliberation: "not-an-iri", participants: [] })).toBe(false);
  });
});

describe("sessionIdentity", () => {
  it("is the demo `you` in demo mode regardless of sign-in", () => {
    const demo = scopedDefaultConfig(SCOPES.apps);
    expect(sessionIdentity(demo, null)).toBe(demoWebId("you"));
    expect(sessionIdentity(demo, "https://real.example/#me")).toBe(demoWebId("you"));
  });

  it("is the signed-in WebID (or null) in pod mode", () => {
    const pod = podConfig();
    expect(sessionIdentity(pod, null)).toBeNull();
    expect(sessionIdentity(pod, "https://real.example/#me")).toBe("https://real.example/#me");
  });
});
