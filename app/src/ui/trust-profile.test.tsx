// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// useTrustProfile's stale-grant window: the profile is KEYED to the exact
// (config, webId) it was resolved for, so switching deliberation/identity
// exposes null (locked, fail-closed) IN THE SAME RENDER — the old scope's
// grant must never bleed into the new one, not even for one frame. Resolution
// runs against the REAL seeded demo trust layer.

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDemoInstances } from "../demo/pods.js";
import { useTrustProfile } from "./hooks.js";
import { demoConfig } from "./state.js";

beforeEach(() => {
  resetDemoInstances();
});

describe("useTrustProfile", () => {
  it("resolves the demo session's verified standing (apps → steward T1)", async () => {
    const { result } = renderHook(() => useTrustProfile(demoConfig("apps"), null));
    expect(result.current.profile).toBeNull(); // resolving = fail-closed
    await waitFor(() => expect(result.current.profile).not.toBeNull(), { timeout: 4000 });
    expect(result.current.profile?.tier).toBe(1);
    expect(result.current.profile?.roles).toContain("steward");
  });

  it("a config change exposes NULL in the same render — never the stale grant", async () => {
    const apps = demoConfig("apps");
    const infra = demoConfig("infrastructure");
    const { result, rerender } = renderHook(({ config }) => useTrustProfile(config, null), {
      initialProps: { config: apps },
    });
    await waitFor(() => expect(result.current.profile?.tier).toBe(1), { timeout: 4000 });
    // Switch deliberation: the apps grant must be GONE synchronously…
    rerender({ config: infra });
    expect(result.current.profile).toBeNull();
    // …and the new scope resolves to its own (unvouched T0) standing.
    await waitFor(() => expect(result.current.profile).not.toBeNull(), { timeout: 4000 });
    expect(result.current.profile).toEqual({ tier: 0, roles: [] });
  });
});
