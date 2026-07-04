// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// resolveScope is the fail-closed gate between untrusted location/env strings
// and the scope configuration; exhaust its precedence + hostile-input paths.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCOPE,
  isScopeId,
  resolveScope,
  SCOPE_ORDER,
  SCOPES,
  type ScopeId,
  scopeHref,
} from "./scopes.js";

describe("SCOPES table", () => {
  it("covers exactly the three ids, in progressive order", () => {
    expect(SCOPE_ORDER).toEqual(["apps", "infrastructure", "society"]);
    expect(Object.keys(SCOPES).sort()).toEqual([...SCOPE_ORDER].sort());
    for (const id of SCOPE_ORDER) expect(SCOPES[id].id).toBe(id);
  });

  it("honest maturity: apps live (S1), infrastructure live (S2), society live (S4)", () => {
    expect(SCOPES[DEFAULT_SCOPE].status).toBe("live");
    expect(SCOPES.infrastructure.status).toBe("live"); // S2: propose/converge + visible ratification
    expect(SCOPES.society.status).toBe("live"); // S4: voice + mapping
  });

  it("society is the open-voice scope; build layer only in apps/infrastructure", () => {
    expect(SCOPES.society.minTierToPropose).toBe(0);
    expect(SCOPES.society.buildLayer).toBe(false);
    expect(SCOPES.apps.buildLayer).toBe(true);
    expect(SCOPES.infrastructure.buildLayer).toBe(true);
  });

  it("host labels are unique across scopes (unambiguous resolution)", () => {
    const all = SCOPE_ORDER.flatMap((id) => [...SCOPES[id].hosts]);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("isScopeId", () => {
  it("accepts exactly the three ids", () => {
    expect(isScopeId("apps")).toBe(true);
    expect(isScopeId("infrastructure")).toBe(true);
    expect(isScopeId("society")).toBe(true);
  });
  it("rejects everything else", () => {
    for (const bad of ["Apps", "infra", "", null, undefined, 3, {}, ["apps"]]) {
      expect(isScopeId(bad)).toBe(false);
    }
  });
});

describe("resolveScope precedence", () => {
  it("defaults to apps with no input", () => {
    expect(resolveScope().id).toBe(DEFAULT_SCOPE);
    expect(resolveScope({}).id).toBe(DEFAULT_SCOPE);
  });

  it("query beats env beats hostname", () => {
    const r = resolveScope({
      search: "?scope=society",
      env: "infrastructure",
      hostname: "apps.unite.jeswr.org",
    });
    expect(r.id).toBe("society");
    const r2 = resolveScope({ env: "infrastructure", hostname: "apps.unite.jeswr.org" });
    expect(r2.id).toBe("infrastructure");
    const r3 = resolveScope({ hostname: "society.unite.jeswr.org" });
    expect(r3.id).toBe("society");
  });

  it("an invalid layer falls THROUGH to the next, never wins as default", () => {
    expect(resolveScope({ search: "?scope=nonsense", hostname: "infra.unite.jeswr.org" }).id).toBe(
      "infrastructure",
    );
    expect(resolveScope({ env: "bogus", hostname: "society.unite.jeswr.org" }).id).toBe("society");
  });
});

describe("resolveScope query parsing", () => {
  it("accepts with and without the leading '?', case/whitespace-leniently", () => {
    expect(resolveScope({ search: "?scope=society" }).id).toBe("society");
    expect(resolveScope({ search: "scope=society" }).id).toBe("society");
    expect(resolveScope({ search: "?scope=SOCIETY" }).id).toBe("society");
    expect(resolveScope({ search: "?scope=%20society%20" }).id).toBe("society");
  });
  it("ignores other params and empty/missing scope", () => {
    expect(resolveScope({ search: "?foo=bar" }).id).toBe(DEFAULT_SCOPE);
    expect(resolveScope({ search: "?scope=" }).id).toBe(DEFAULT_SCOPE);
    expect(resolveScope({ search: "" }).id).toBe(DEFAULT_SCOPE);
  });
  it("survives hostile search strings (fail-closed to default)", () => {
    for (const hostile of [
      "?scope=<script>alert(1)</script>",
      "?scope=apps%00society",
      `?scope=${"a".repeat(10000)}`,
      "?".repeat(5000),
      "?scope=apps&scope=society", // first value wins per URLSearchParams.get
    ]) {
      const id = resolveScope({ search: hostile }).id;
      expect(SCOPE_ORDER.includes(id)).toBe(true);
    }
    // the duplicate-param case concretely: get() returns the first
    expect(resolveScope({ search: "?scope=society&scope=apps" }).id).toBe("society");
  });
});

describe("scopeHref", () => {
  it("preserves other query params and the hash while setting scope", () => {
    expect(scopeHref("society", "?code=abc&state=xyz", "#inbox")).toBe(
      "?code=abc&state=xyz&scope=society#inbox",
    );
  });
  it("replaces an existing scope param instead of duplicating it", () => {
    const href = scopeHref("infrastructure", "?scope=apps&foo=1", "");
    expect(href).toContain("scope=infrastructure");
    expect(href).not.toContain("scope=apps");
    expect(href).toContain("foo=1");
  });
  it("degrades to just ?scope= on missing/malformed/oversized input", () => {
    expect(scopeHref("apps")).toBe("?scope=apps");
    expect(scopeHref("apps", null, null)).toBe("?scope=apps");
    expect(scopeHref("apps", `?x=${"a".repeat(10000)}`, "no-leading-hash")).toBe("?scope=apps");
  });
});

describe("resolveScope hostname matching", () => {
  const cases: readonly [string, ScopeId][] = [
    ["apps.unite.jeswr.org", "apps"],
    ["APPS.UNITE.JESWR.ORG", "apps"],
    ["infra.unite.jeswr.org", "infrastructure"],
    ["infrastructure.unite.jeswr.org", "infrastructure"],
    ["society.unite.jeswr.org", "society"],
  ];
  it.each(cases)("%s → %s", (hostname, expected) => {
    expect(resolveScope({ hostname }).id).toBe(expected);
  });

  it("matches the FIRST label only", () => {
    // "apps" appearing deeper in the hostname must not select the scope
    expect(resolveScope({ hostname: "evil.apps.example" }).id).toBe(DEFAULT_SCOPE);
    expect(resolveScope({ hostname: "unite.jeswr.org" }).id).toBe(DEFAULT_SCOPE);
    expect(resolveScope({ hostname: "localhost" }).id).toBe(DEFAULT_SCOPE);
    expect(resolveScope({ hostname: "unite-abc123.vercel.app" }).id).toBe(DEFAULT_SCOPE);
  });

  it("survives hostile hostnames (fail-closed to default)", () => {
    for (const hostile of ["", ".", "..", `${"x".repeat(300)}.example`, "societyX.example"]) {
      expect(resolveScope({ hostname: hostile }).id).toBe(DEFAULT_SCOPE);
    }
  });
});

// ── The S0 scope-differentiation seams (docs/SCOPE-DIFFERENTIATION.md §5.3) ──

describe("scope seams (S0)", () => {
  it("apps carries the reference (safe-default) seam values", () => {
    const a = SCOPES.apps;
    expect(a.composeFlow).toBe("need-first");
    expect(a.artifactKinds).toContain("need");
    expect(a.outputKind).toBe("build-commission");
    expect(a.endorsementGate.reviewerRoleRequired).toBe(false);
  });

  it("every scope collects needs — the universal artifact kind", () => {
    for (const id of SCOPE_ORDER) expect(SCOPES[id].artifactKinds).toContain("need");
  });

  it("the opinion lens is always on, and always first", () => {
    for (const id of SCOPE_ORDER) expect(SCOPES[id].cohortLenses[0]).toBe("opinion");
  });

  it("compose grammars differ per scope (the §1 differentiation thesis)", () => {
    expect(SCOPES.apps.composeFlow).toBe("need-first");
    expect(SCOPES.infrastructure.composeFlow).toBe("structured-infra");
    expect(SCOPES.society.composeFlow).toBe("narrative-decompose");
  });

  it("output pipelines differ per scope (§1 row 5)", () => {
    expect(SCOPES.apps.outputKind).toBe("build-commission");
    expect(SCOPES.infrastructure.outputKind).toBe("adoption-decision");
    expect(SCOPES.society.outputKind).toBe("advisory-synthesis");
  });

  it("B's endorsement gate requires BOTH partitions + a reviewer (§3.4/§3.5)", () => {
    const g = SCOPES.infrastructure.endorsementGate;
    expect([...g.crossCohort].sort()).toEqual(["opinion", "role"]);
    expect(g.reviewerRoleRequired).toBe(true);
  });

  it("B computes the role lens; C the tier lens (§3.4 / §4.4)", () => {
    expect(SCOPES.infrastructure.cohortLenses).toContain("role");
    expect(SCOPES.infrastructure.cohortLenses).not.toContain("tier");
    expect(SCOPES.society.cohortLenses).toContain("tier");
    expect(SCOPES.society.cohortLenses).not.toContain("role");
  });

  it("steward-signature floor is ≥2 everywhere (PLATFORM-PLAN §4.4 — never lowered)", () => {
    for (const id of SCOPE_ORDER) {
      expect(SCOPES[id].endorsementGate.stewardSignatures).toBeGreaterThanOrEqual(2);
    }
  });

  it("every crossCohort partition is also a computed lens (endorsement can't gate on an uncomputed partition)", () => {
    for (const id of SCOPE_ORDER) {
      const s = SCOPES[id];
      for (const c of s.endorsementGate.crossCohort) {
        expect(s.cohortLenses).toContain(c);
      }
    }
  });

  it("B's S2 surface: the infra artifact, the shared spine views, the adoption board", () => {
    expect(SCOPES.infrastructure.artifactKinds).toEqual(["need", "infra-proposal"]);
    expect(SCOPES.infrastructure.views).toEqual(["proposals", "room", "adoption-board"]);
    expect(SCOPES.infrastructure.composeFlow).toBe("structured-infra");
  });

  it("B and C name their signature views (honest previews until built)", () => {
    expect(SCOPES.infrastructure.views).toContain("adoption-board");
    expect(SCOPES.society.views).toEqual(
      expect.arrayContaining(["deck", "futures-gallery", "published-futures"]),
    );
  });

  it("extra views are unique within a scope", () => {
    for (const id of SCOPE_ORDER) {
      const v = SCOPES[id].views;
      expect(new Set(v).size).toBe(v.length);
    }
  });
});
