// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The C4 sensitive-domain screen (SCOPE-DIFFERENTIATION §4.5 hard gate): the
// deterministic lexical half of the launch constraint. The failure mode to
// avoid is false positives on ORDINARY CIVIC SPEECH — mentioning a hospital
// as a destination must pass; disclosing "my diagnosis" must not.

import { describe, expect, it } from "vitest";
import { assertNotSensitive, SensitiveDomainError, screenSensitiveDomain } from "./sensitive.js";

describe("screenSensitiveDomain", () => {
  it("blocks first-person health disclosure", () => {
    expect(screenSensitiveDomain("Since my diagnosis I can't drive")).toEqual({
      domain: "health",
      term: "my diagnosis",
    });
    expect(screenSensitiveDomain("I was DIAGNOSED WITH asthma last year")?.domain).toBe("health");
    expect(screenSensitiveDomain("my medication makes the bus essential")?.domain).toBe("health");
    expect(screenSensitiveDomain("I'm pregnant and the pavements are unsafe")?.domain).toBe(
      "health",
    );
  });

  it("blocks first-person finance disclosure", () => {
    expect(screenSensitiveDomain("My salary is £32k and parking eats it")).toEqual({
      domain: "finance",
      term: "my salary",
    });
    expect(screenSensitiveDomain("my debt keeps me from moving house")?.domain).toBe("finance");
    expect(screenSensitiveDomain("with MY CREDIT SCORE I can't get a flat")?.domain).toBe(
      "finance",
    );
  });

  it("PASSES ordinary civic speech about institutions and budgets", () => {
    for (const civic of [
      "The hospital needs a bus stop at its entrance.",
      "The clinic car park floods every winter.",
      "The council's budget should prioritise pavements over parking.",
      "Funding for parks matters more than road widening.",
      "A pharmacy within walking distance of every estate.",
      "Cheaper bus fares would help people on low incomes.",
      "I want my children to reach school, a park and a shop on foot.",
    ]) {
      expect(screenSensitiveDomain(civic)).toBeNull();
    }
  });

  it("is case-insensitive and matches inside longer text", () => {
    expect(screenSensitiveDomain("…and, honestly, My Doctor Says I shouldn't cycle…")?.domain).toBe(
      "health",
    );
  });

  it("reports health before finance when both trip (stable ordering)", () => {
    expect(screenSensitiveDomain("my diagnosis ruined my savings")?.domain).toBe("health");
  });
});

describe("assertNotSensitive (the write-chokepoint guard)", () => {
  it("throws a plain-language SensitiveDomainError naming the C4 gate", () => {
    expect(() => assertNotSensitive("my diagnosis is private")).toThrowError(SensitiveDomainError);
    try {
      assertNotSensitive("my diagnosis is private");
    } catch (e) {
      expect(e).toBeInstanceOf(SensitiveDomainError);
      expect((e as Error).message).toMatch(/low-sensitivity civic topics/);
      expect((e as Error).message).toMatch(/C4 launch gate/);
    }
  });

  it("passes clean civic text through", () => {
    expect(() => assertNotSensitive("Ban through-traffic on residential streets")).not.toThrow();
  });
});
