// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// CONSENT-MOMENT fixtures (design/v2 02 §7): the decision is WRITTEN to the
// person's own pod as an ODRL policy (through the v1 consent layer — typed
// quads, never hand-built strings), and the session memory keeps the "never
// re-asked" promise — a no is remembered exactly like a yes.

import { beforeEach, describe, expect, it } from "vitest";
import { getDemoDeliberation, resetDemoInstances } from "../demo/pods.js";
import {
  decisionFor,
  recordConsentDecision,
  rememberDecision,
  resetConsentMemory,
} from "./consent-moments.js";

beforeEach(() => {
  resetDemoInstances();
  resetConsentMemory();
});

describe("recordConsentDecision", () => {
  it("writes the decision into the person's OWN pod, under consents/", async () => {
    const demo = await getDemoDeliberation("society");
    const { url } = await recordConsentDecision(demo.fetch, demo.you.base, {
      about: `${demo.you.base}claims/one.ttl`,
      asked: "We're asking Maria about the crossing. Okay?",
      granted: true,
      creator: demo.you.webId,
      created: "2026-06-25T00:00:00Z",
    });
    expect(url.startsWith(demo.you.base)).toBe(true);
    expect(url).toContain("/consents/");
    const res = await demo.fetch(url);
    expect(res.ok).toBe(true);
    const body = await res.text();
    expect(body).toContain("odrl"); // the ODRL policy, via the v1 consent layer
    expect(body).toContain("asking Maria"); // the plain-words ask, kept with it
  });

  it("a declined moment is recorded the same way (a no is a real answer)", async () => {
    const demo = await getDemoDeliberation("society");
    const { url } = await recordConsentDecision(demo.fetch, demo.you.base, {
      about: `${demo.you.base}claims/one.ttl`,
      asked: "Okay?",
      granted: false,
      creator: demo.you.webId,
      created: "2026-06-25T00:00:00Z",
    });
    const body = await (await demo.fetch(url)).text();
    expect(body).toContain("prohibition"); // synthesize prohibited on decline
  });
});

describe("the session memory — asked once, never re-asked", () => {
  it("remembers yes and no alike", () => {
    expect(decisionFor("expert:cost")).toBeUndefined();
    rememberDecision("expert:cost", false);
    expect(decisionFor("expert:cost")).toBe(false);
    rememberDecision("expert:other", true);
    expect(decisionFor("expert:other")).toBe(true);
  });
});
