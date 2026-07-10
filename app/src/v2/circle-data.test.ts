// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The circle chat data layer over the REAL demo pods: write through the
// production path, read back through the creator-verified fold. The §2a gate
// split's first half lives here: utterances are UNGATED — a sensitive
// disclosure SENDS, stands, and is heard (design/v2 02 §4.1).

import { beforeEach, describe, expect, it } from "vitest";
import { demoBase, demoWebId } from "../demo/fixtures.js";
import { getDemoDeliberation, resetDemoInstances } from "../demo/pods.js";
import { readCircleMessages, writeCircleMessage } from "./circle-data.js";
import {
  DEMO_CIRCLE,
  demoCircleParticipants,
  ensureDemoCircleSeeded,
  resetDemoCircleSeed,
} from "./demo-circle.js";

beforeEach(() => {
  resetDemoInstances();
  resetDemoCircleSeed();
});

describe("the seeded demo circle", () => {
  it("seeds the conversation through the production write path, idempotently", async () => {
    const demo = await getDemoDeliberation("society");
    await ensureDemoCircleSeeded(demo);
    const first = await readCircleMessages(
      demo.fetch,
      demoCircleParticipants(demo),
      DEMO_CIRCLE.id,
    );
    expect(first.length).toBeGreaterThanOrEqual(6);
    // Deterministic order: published ascending.
    const stamps = first.map((m) => m.published ?? "");
    expect([...stamps].sort()).toEqual(stamps);
    // Idempotent: seeding again adds nothing.
    resetDemoCircleSeed();
    await ensureDemoCircleSeeded(demo);
    const second = await readCircleMessages(
      demo.fetch,
      demoCircleParticipants(demo),
      DEMO_CIRCLE.id,
    );
    expect(second.length).toBe(first.length);
  });
});

describe("writeCircleMessage + readCircleMessages", () => {
  it("round-trips a visitor message (own pod, own voice)", async () => {
    const demo = await getDemoDeliberation("society");
    await ensureDemoCircleSeeded(demo);
    const { url, id } = await writeCircleMessage(demo.fetch, demo.you.base, {
      author: demo.you.webId,
      content: "Mornings should start with birdsong, not brakes.",
      circle: DEMO_CIRCLE.id,
      published: "2026-07-01T08:00:00Z",
    });
    expect(url.startsWith(demo.you.base)).toBe(true);
    const messages = await readCircleMessages(
      demo.fetch,
      demoCircleParticipants(demo),
      DEMO_CIRCLE.id,
    );
    const mine = messages.find((m) => m.id === id);
    expect(mine).toMatchObject({
      author: demo.you.webId,
      content: "Mornings should start with birdsong, not brakes.",
    });
  });

  it("UNGATED utterances (§2a): a sensitive disclosure SENDS with no refusal", async () => {
    const demo = await getDemoDeliberation("society");
    const sensitive = "My disability makes this crossing terrifying.";
    const { id } = await writeCircleMessage(demo.fetch, demo.you.base, {
      author: demo.you.webId,
      content: sensitive,
      circle: DEMO_CIRCLE.id,
      published: "2026-07-01T08:05:00Z",
    });
    const messages = await readCircleMessages(demo.fetch, [demo.you], DEMO_CIRCLE.id);
    // The person's own words, in their own pod, visible to their circle —
    // sent, standing, heard. No error, no moderation, no spinner.
    expect(messages.find((m) => m.id === id)?.content).toBe(sensitive);
  });

  it("creator-owns-the-pod: a message asserting someone else's voice is dropped", async () => {
    const demo = await getDemoDeliberation("society");
    // A hostile write INTO you's pod claiming farah authored it.
    await writeCircleMessage(demo.fetch, demo.you.base, {
      author: demoWebId("farah"),
      content: "a forged attribution",
      circle: DEMO_CIRCLE.id,
      published: "2026-07-01T09:00:00Z",
      name: "cm-forged",
    });
    const messages = await readCircleMessages(demo.fetch, [demo.you], DEMO_CIRCLE.id);
    expect(messages.some((m) => m.content === "a forged attribution")).toBe(false);
  });

  it("reads only THIS circle's messages (as:context is the room filter)", async () => {
    const demo = await getDemoDeliberation("society");
    await writeCircleMessage(demo.fetch, demo.you.base, {
      author: demo.you.webId,
      content: "a different room's message",
      circle: "https://demo.unite.example/circles/society/other",
      published: "2026-07-01T09:10:00Z",
      name: "cm-other-room",
    });
    const messages = await readCircleMessages(demo.fetch, [demo.you], DEMO_CIRCLE.id);
    expect(messages.some((m) => m.content === "a different room's message")).toBe(false);
  });

  it("refuses to write outside the author's own base (fail-closed scope guard)", async () => {
    const demo = await getDemoDeliberation("society");
    await expect(
      writeCircleMessage(demo.fetch, demoBase("farah", "society"), {
        author: demo.you.webId,
        content: "writing into someone else's pod",
        circle: DEMO_CIRCLE.id,
        published: "2026-07-01T09:20:00Z",
        // childUrl composes within the base — the guard is assertWithinBase on
        // a hostile name trying to escape it.
        name: "../../escape",
      }),
    ).rejects.toThrow();
  });
});
