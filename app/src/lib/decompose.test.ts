// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The decomposition seam (SCOPE-DIFFERENTIATION §4.3 step 2): manual-first —
// the reference implementation proposes NOTHING (the author splits their own
// story); an assisted implementation must disclose provenance. Adoption is
// downstream and identical either way.

import { describe, expect, it } from "vitest";
import {
  atomFromSelection,
  type DecompositionAssistant,
  MANUAL_DECOMPOSITION,
} from "./decompose.js";

describe("MANUAL_DECOMPOSITION (the reference implementation)", () => {
  it("proposes no atoms and discloses no provenance (the author decomposes)", async () => {
    const result = await MANUAL_DECOMPOSITION.decompose("I want walkable streets.");
    expect(result.atoms).toEqual([]);
    expect(result.provenance).toBeUndefined();
  });

  it("an assisted implementation slots into the same seam with provenance", async () => {
    const assisted: DecompositionAssistant = {
      decompose: (narrative) =>
        Promise.resolve({
          atoms: [{ kind: "claim", content: narrative.slice(0, 20) }],
          provenance: { tool: "example-model", plan: "prompt-v1" },
        }),
    };
    const result = await assisted.decompose("I want walkable streets.");
    expect(result.atoms).toHaveLength(1);
    expect(result.provenance).toEqual({ tool: "example-model", plan: "prompt-v1" });
  });
});

describe("atomFromSelection", () => {
  it("trims the selection into an atom draft", () => {
    expect(atomFromSelection("claim", "  safe crossings for all  ")).toEqual({
      kind: "claim",
      content: "safe crossings for all",
    });
  });

  it("returns null for an empty/whitespace selection (no blank atoms)", () => {
    expect(atomFromSelection("need", "")).toBeNull();
    expect(atomFromSelection("value", "   \n ")).toBeNull();
  });
});
