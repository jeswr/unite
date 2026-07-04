// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// scopedDefaultConfig must give every scope its OWN default deliberation +
// container — the resolved scope drives the data layer, not just chrome.

import { describe, expect, it } from "vitest";
import { SCOPE_ORDER, SCOPES } from "../scope/scopes.js";
import { buildRegistry, buildVerifier, DEFAULT_CONFIG, scopedDefaultConfig } from "./state.js";

describe("scopedDefaultConfig", () => {
  it("gives each scope a distinct deliberation + container, segmented by scope id", () => {
    const configs = SCOPE_ORDER.map((id) => scopedDefaultConfig(SCOPES[id]));
    for (const [i, id] of SCOPE_ORDER.entries()) {
      const c = configs[i];
      expect(c?.deliberation).toBe(`https://community.example/deliberations/${id}`);
      expect(c?.ownBase).toBe(`https://alice.example/unite/${id}/`);
      expect(c?.participants[0]?.base).toBe(c?.ownBase);
    }
    expect(new Set(configs.map((c) => c?.deliberation)).size).toBe(SCOPE_ORDER.length);
    expect(new Set(configs.map((c) => c?.ownBase)).size).toBe(SCOPE_ORDER.length);
  });

  it("the apps scope matches the legacy DEFAULT_CONFIG (no behaviour change)", () => {
    expect(scopedDefaultConfig(SCOPES.apps)).toEqual(DEFAULT_CONFIG);
  });

  it("every scoped default is accepted by the registry + verifier constructors", () => {
    for (const id of SCOPE_ORDER) {
      const config = scopedDefaultConfig(SCOPES[id]);
      expect(() => buildRegistry(config)).not.toThrow();
      expect(() => buildVerifier(config)).not.toThrow();
    }
  });
});
