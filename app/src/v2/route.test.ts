// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The v2 hash routes — parse-only V0 acceptance: every design/v2 route parses,
// everything else fails closed to the commons, and ids stay opaque selectors.

import { describe, expect, it } from "vitest";
import { DEFAULT_V2_ROUTE, parseV2Hash, v2Hash } from "./route.js";

describe("parseV2Hash", () => {
  it("parses the five v2 routes", () => {
    expect(parseV2Hash("#/commons")).toEqual({ view: "commons" });
    expect(parseV2Hash("#/notebook")).toEqual({ view: "notebook" });
    expect(parseV2Hash("#/how")).toEqual({ view: "how" });
    expect(parseV2Hash("#/circle/maple-mornings")).toEqual({
      view: "circle",
      id: "maple-mornings",
    });
    expect(parseV2Hash("#/story/crossing")).toEqual({ view: "story", id: "crossing" });
  });

  it("parses the V3–V5 routes (circles / arc / curtain / join-us)", () => {
    expect(parseV2Hash("#/circles")).toEqual({ view: "circles" });
    expect(parseV2Hash("#/arc")).toEqual({ view: "arc" });
    expect(parseV2Hash("#/curtain")).toEqual({ view: "curtain" });
    expect(parseV2Hash("#/join-us")).toEqual({ view: "join-us" });
  });

  it("is lenient on the leading #/ and query-ish suffixes", () => {
    expect(parseV2Hash("#commons")).toEqual({ view: "commons" });
    expect(parseV2Hash("#/commons?x=1")).toEqual({ view: "commons" });
    expect(parseV2Hash("#/circle/maple?x=1")).toEqual({ view: "circle", id: "maple" });
  });

  it("decodes an encoded id", () => {
    expect(parseV2Hash("#/circle/maple%20mornings")).toEqual({
      view: "circle",
      id: "maple mornings",
    });
  });

  it("fails closed to the commons on anything unrecognised", () => {
    expect(parseV2Hash(undefined)).toEqual(DEFAULT_V2_ROUTE);
    expect(parseV2Hash(null)).toEqual(DEFAULT_V2_ROUTE);
    expect(parseV2Hash("")).toEqual(DEFAULT_V2_ROUTE);
    expect(parseV2Hash("#/")).toEqual(DEFAULT_V2_ROUTE);
    expect(parseV2Hash("#/board")).toEqual(DEFAULT_V2_ROUTE); // a v1 route
    expect(parseV2Hash("#/overview")).toEqual(DEFAULT_V2_ROUTE);
    expect(parseV2Hash("#/admin")).toEqual(DEFAULT_V2_ROUTE);
    expect(parseV2Hash(`#/${"x".repeat(600)}`)).toEqual(DEFAULT_V2_ROUTE);
  });

  it("fails closed on malformed param routes", () => {
    expect(parseV2Hash("#/circle")).toEqual(DEFAULT_V2_ROUTE); // id required
    expect(parseV2Hash("#/circle/")).toEqual(DEFAULT_V2_ROUTE);
    expect(parseV2Hash("#/circle/a/b")).toEqual(DEFAULT_V2_ROUTE); // too deep
    expect(parseV2Hash(`#/circle/${"x".repeat(300)}`)).toEqual(DEFAULT_V2_ROUTE); // over-long id
    expect(parseV2Hash("#/circle/%")).toEqual(DEFAULT_V2_ROUTE); // undecodable
    expect(parseV2Hash("#/commons/extra")).toEqual({ view: "commons" }); // non-param ignores depth
  });
});

describe("v2Hash", () => {
  it("renders canonical hashes (round-trips with the parser)", () => {
    expect(v2Hash({ view: "commons" })).toBe("#/commons");
    expect(v2Hash({ view: "circle", id: "maple mornings" })).toBe("#/circle/maple%20mornings");
    expect(parseV2Hash(v2Hash({ view: "story", id: "crossing" }))).toEqual({
      view: "story",
      id: "crossing",
    });
  });
});
