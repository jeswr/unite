// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Production login wiring. Two concerns: the pure client_id / callback-URI
// derivations (precedence: explicit env → prod self-derive → dev dynamic-reg),
// and that buildController() ensures the popup driver element and constructs the
// reactive-auth controller with the derived URIs — the auth modules mocked so no
// real credential machinery runs.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { createReactiveAuthController } = vi.hoisted(() => ({
  createReactiveAuthController: vi.fn((_opts: Record<string, unknown>) => ({ webId: null })),
}));
// The registration subpath defines <authorization-code-flow>. Mock it to define a
// minimal element that exposes getCode — so the test asserts (a) controller.ts
// imports the REGISTRATION subpath (this mock hooks that exact specifier) and
// (b) the element buildController creates actually exposes the getCode the
// reactive-auth controller binds. (The bare package entry does NOT register it.)
vi.mock("@solid/reactive-authentication/registerElements", () => {
  class AuthorizationCodeFlow extends HTMLElement {
    getCode(): Promise<string> {
      return Promise.resolve("test-code");
    }
  }
  if (!customElements.get("authorization-code-flow")) {
    customElements.define("authorization-code-flow", AuthorizationCodeFlow);
  }
  return {};
});
vi.mock("@jeswr/solid-elements/auth", () => ({ createReactiveAuthController }));

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildController,
  CALLBACK_PATH,
  CANONICAL_ORIGIN,
  CLIENT_ID_PATH,
  deriveCallbackUri,
  deriveClientId,
  parseAllowedOrigins,
} from "./controller.js";

describe("deriveClientId", () => {
  it("prefers an explicit VITE_CLIENT_ID (trimmed)", () => {
    expect(deriveClientId({ VITE_CLIENT_ID: "  https://x.example/cid.jsonld  " })).toBe(
      "https://x.example/cid.jsonld",
    );
  });

  it("derives from the CANONICAL origin in a production build (not the runtime origin)", () => {
    expect(deriveClientId({ PROD: true })).toBe(`${CANONICAL_ORIGIN}${CLIENT_ID_PATH}`);
  });

  it("honours a VITE_APP_ORIGIN override in production", () => {
    expect(deriveClientId({ PROD: true, VITE_APP_ORIGIN: "https://unite.example" })).toBe(
      `https://unite.example${CLIENT_ID_PATH}`,
    );
  });

  it("returns undefined (dynamic registration) in dev with no explicit id", () => {
    expect(deriveClientId({ PROD: false, DEV: true })).toBeUndefined();
  });

  it("ignores a blank VITE_CLIENT_ID and falls through", () => {
    expect(deriveClientId({ VITE_CLIENT_ID: "   ", PROD: true })).toBe(
      `${CANONICAL_ORIGIN}${CLIENT_ID_PATH}`,
    );
    expect(deriveClientId({ VITE_CLIENT_ID: "" })).toBeUndefined();
  });
});

describe("deriveCallbackUri", () => {
  it("uses the canonical origin in production (matches the Client ID Document)", () => {
    expect(deriveCallbackUri({ PROD: true }, "https://preview-abc.vercel.app/x")).toBe(
      `${CANONICAL_ORIGIN}${CALLBACK_PATH}`,
    );
  });

  it("uses the runtime href in dev", () => {
    expect(deriveCallbackUri({ DEV: true }, "http://localhost:5173/index.html")).toBe(
      `http://localhost:5173${CALLBACK_PATH}`,
    );
  });

  it("derives the callback from a PINNED VITE_CLIENT_ID's origin (redirect_uri stays listed)", () => {
    const env = {
      VITE_CLIENT_ID: "https://pinned.example/clientid.jsonld",
      VITE_APP_ORIGIN: "https://other.example",
    };
    // client_id + callback MUST share an origin — the pinned doc's, not VITE_APP_ORIGIN.
    expect(deriveClientId(env)).toBe("https://pinned.example/clientid.jsonld");
    expect(deriveCallbackUri(env, "https://runtime.example/")).toBe(
      `https://pinned.example${CALLBACK_PATH}`,
    );
  });

  it("keeps client_id + callback on the same VITE_APP_ORIGIN override", () => {
    const env = { PROD: true, VITE_APP_ORIGIN: "https://unite.example" };
    expect(deriveClientId(env)).toBe(`https://unite.example${CLIENT_ID_PATH}`);
    expect(deriveCallbackUri(env, "https://ignored/")).toBe(
      `https://unite.example${CALLBACK_PATH}`,
    );
  });
});

describe("parseAllowedOrigins", () => {
  it("parses comma/space separated origins, deduped, invalid dropped", () => {
    expect(
      parseAllowedOrigins({
        VITE_ALLOWED_ORIGINS:
          "https://pod.example, https://pod.example/x  not-a-url https://b.example",
      }),
    ).toEqual(["https://pod.example", "https://b.example"]);
  });

  it("returns [] when unset", () => {
    expect(parseAllowedOrigins({})).toEqual([]);
  });
});

describe("the served Client Identifier Document is consistent with the derived URIs", () => {
  // vitest runs with cwd = the app package root, so the public/ doc is here.
  const doc = JSON.parse(readFileSync(resolve("public/clientid.jsonld"), "utf8")) as {
    client_id: string;
    redirect_uris: string[];
  };

  it("client_id equals the production-derived clientId (and its own served URL)", () => {
    const derived = deriveClientId({ PROD: true });
    expect(doc.client_id).toBe(derived);
    // The Solid-OIDC rule: client_id === the document's own served URL.
    expect(doc.client_id).toBe(`${CANONICAL_ORIGIN}${CLIENT_ID_PATH}`);
  });

  it("redirect_uris lists the production-derived callback URI", () => {
    expect(doc.redirect_uris).toContain(deriveCallbackUri({ PROD: true }, "https://ignored/"));
  });
});

describe("buildController", () => {
  beforeEach(() => {
    createReactiveAuthController.mockClear();
    for (const n of document.querySelectorAll("authorization-code-flow")) n.remove();
  });

  it("ensures the popup driver element and wires the reactive-auth controller", () => {
    buildController();
    // Exactly one popup driver appended.
    expect(document.querySelectorAll("authorization-code-flow")).toHaveLength(1);
    expect(createReactiveAuthController).toHaveBeenCalledTimes(1);
    const call = createReactiveAuthController.mock.calls[0];
    if (!call) throw new Error("controller not constructed");
    const opts = call[0];
    expect(String(opts.callbackUri)).toContain(CALLBACK_PATH);
    expect(opts.dbName).toBe("unite:sessions");
    expect(opts.authFlow).toBeInstanceOf(HTMLElement);
    // The popup driver must expose getCode — the reactive-auth controller binds
    // it for the interactive login leg (regression guard for the registration bug).
    expect(typeof (opts.authFlow as { getCode?: unknown }).getCode).toBe("function");
    // vitest runs as a DEV build → dynamic registration (no static clientId).
    expect(opts.clientId).toBeUndefined();
  });

  it("reuses an existing popup driver element (does not duplicate)", () => {
    document.body.append(document.createElement("authorization-code-flow"));
    buildController();
    expect(document.querySelectorAll("authorization-code-flow")).toHaveLength(1);
  });

  it("threads VITE_ALLOWED_ORIGINS into the controller (split WebID/storage topology)", () => {
    vi.stubEnv("VITE_ALLOWED_ORIGINS", "https://pod.example, https://cdn.example");
    try {
      buildController();
      const opts = createReactiveAuthController.mock.calls[0]?.[0];
      expect(opts?.allowedOrigins).toEqual(["https://pod.example", "https://cdn.example"]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("omits allowedOrigins by default (WebID + issuer origin suffice)", () => {
    buildController();
    const opts = createReactiveAuthController.mock.calls[0]?.[0];
    expect(opts?.allowedOrigins).toBeUndefined();
  });
});
