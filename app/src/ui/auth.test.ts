// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The auth seam controllers. The security-relevant properties: the production
// default never fakes a session (fail-closed), and publicFetch is credential-free.

import { afterEach, describe, expect, it, vi } from "vitest";
import { DevLoginController, makeDefaultController, UnconfiguredLoginController } from "./auth.js";

describe("UnconfiguredLoginController (production fail-closed)", () => {
  it("never appears signed in and rejects login", async () => {
    const c = new UnconfiguredLoginController();
    expect(c.webId).toBeNull();
    expect(c.recentAccounts()).toEqual([]);
    expect(await c.restore()).toEqual({ outcome: "login" });
    await expect(c.login()).rejects.toThrow(/not configured/i);
  });
});

describe("DevLoginController (dev only)", () => {
  it("records a WebID on login and clears on logout", async () => {
    const c = new DevLoginController();
    expect(c.webId).toBeNull();
    const { webId } = await c.login("https://alice.example/#me");
    expect(webId).toBe("https://alice.example/#me");
    expect(c.webId).toBe("https://alice.example/#me");
    await c.logout();
    expect(c.webId).toBeNull();
  });
});

describe("publicFetch is credential-free", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("forces credentials: omit on the public fetch", async () => {
    const spy = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", spy);
    const c = new UnconfiguredLoginController();
    await c.publicFetch("https://foreign.example/x");
    expect(spy).toHaveBeenCalledWith("https://foreign.example/x", { credentials: "omit" });
  });
});

describe("makeDefaultController", () => {
  it("returns the dev controller in a DEV build (vitest runs in dev mode)", () => {
    // import.meta.env.DEV is true under vitest; the production branch returns an
    // UnconfiguredLoginController, exercised directly above.
    expect(makeDefaultController()).toBeInstanceOf(DevLoginController);
  });
});
