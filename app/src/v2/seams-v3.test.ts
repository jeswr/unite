// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The V3/V4 seam fixtures (design/v2 03 §6, 04 §2, 07 §5): the invitation
// seam is a TOTAL renderer over the composition-reason discriminant, and only
// the diverse variant may claim diversity — the overflow / cold-start /
// starter variants say honestly what they are (the vacuous-diversity guard's
// surface half). The gallery seam claims a divide only when one is computed.

import { describe, expect, it } from "vitest";
import type { CircleReason } from "../lib/circles.js";
import { circleInvitationSeam, gallerySeam } from "./seams.js";

const DIVERSE: CircleReason = {
  kind: "diverse",
  clustersSpanned: [0, 1],
  sharedNeedConcepts: ["https://w3id.org/jeswr/sectors/futures#maxneef-protection"],
};
const OVERFLOW: CircleReason = { kind: "overflow", cluster: 0, openSeats: 2 };
const COLD: CircleReason = { kind: "cold-start", sharedNeedConcepts: [] };
const STARTER: CircleReason = { kind: "starter", communitySize: 3 };

describe("circleInvitationSeam — only diverse claims diversity (04 §2)", () => {
  it("diverse names the span AND the bridge", () => {
    const seam = circleInvitationSeam(DIVERSE);
    expect(seam).toContain("span the community's different ways of seeing");
  });

  it("overflow renders the OVERFLOW variant — never the diversity sentence", () => {
    const seam = circleInvitationSeam(OVERFLOW);
    expect(seam).toContain("see the street pretty similarly");
    expect(seam).toContain("open seats held");
    expect(seam).not.toContain("span the community");
  });

  it("cold-start claims need-overlap only, and says the map is absent", () => {
    const seam = circleInvitationSeam(COLD);
    expect(seam).toContain("no opinion map");
    expect(seam).not.toContain("span the community");
  });

  it("starter claims nothing at all", () => {
    const seam = circleInvitationSeam(STARTER);
    expect(seam).toContain("everyone so far");
    expect(seam).toContain("claims nothing");
    expect(seam).not.toContain("span the community");
  });

  it("no variant renders a tally or percentage (no numbers about people)", () => {
    for (const reason of [DIVERSE, OVERFLOW, COLD, STARTER]) {
      expect(circleInvitationSeam(reason)).not.toMatch(/\d+\s*%|\b\d+ people\b/);
    }
  });
});

describe("gallerySeam — the contact prior, honestly divided (03 §6)", () => {
  it("claims a divide only when one was computed", () => {
    expect(gallerySeam("Dana", [], true)).toContain("different place on the map");
    const noDivide = gallerySeam("Dana", [], false);
    expect(noDivide).not.toContain("different place on the map");
    expect(noDivide).toContain("no divide is claimed");
  });
});
