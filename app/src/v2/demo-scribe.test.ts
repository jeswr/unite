// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// DEMO-SCRIBE honesty fixtures (design/v2 06 §4): the canned-mirror overlay
// is PERSONA-ONLY by construction — keyed by seeded message name, so a
// visitor's free-text path can never resolve a canned line; every canned key
// belongs to a known persona; and the seam carries the 06 §4 disclosure.

import { describe, expect, it } from "vitest";
import { DEMO_VOICE_LABEL, PERSONA_MIRRORS, personaMirrorFor, SCRIBE_SEAM } from "./demo-scribe.js";

const PERSONA_KEYS = ["farah", "chidi", "gus", "hana"];

describe("the persona-mirror overlay is persona-only (06 §2/§4)", () => {
  it("every canned key names a seeded persona message — never the visitor", () => {
    for (const key of Object.keys(PERSONA_MIRRORS)) {
      expect(key.startsWith("cm-")).toBe(true);
      expect(PERSONA_KEYS.some((p) => key.startsWith(`cm-${p}-`))).toBe(true);
    }
  });

  it("resolves a seeded persona resource", () => {
    const url =
      "https://demo.unite.example/pods/farah/unite/society/circle-messages/cm-farah-wish.ttl";
    expect(personaMirrorFor(url)).toContain("kids on bikes");
  });

  it("a visitor's slug-named message can NEVER hit the table", () => {
    // Visitor messages are written under crypto-random slugs (lib/pod slug()),
    // which are not in the closed canned set.
    const url =
      "https://demo.unite.example/pods/you/unite/society/circle-messages/8f3a2b1c9d4e.ttl";
    expect(personaMirrorFor(url)).toBeNull();
    expect(personaMirrorFor("not-a-url")).toBeNull();
  });

  it("the seam is the 06 §4 sentence and the label says demo voice", () => {
    expect(SCRIBE_SEAM).toContain("deterministic reference listener");
    expect(SCRIBE_SEAM).toContain("recorded on every draft");
    expect(DEMO_VOICE_LABEL).toBe("demo voice");
  });
});
