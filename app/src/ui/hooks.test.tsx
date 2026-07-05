// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Regression tests for the aggregation stale-guard + the auto-load behaviour:
// the hook aggregates on mount (no manual Refresh needed), an out-of-order
// response must not clobber a newer one, and a config change must invalidate an
// in-flight request. aggregateDeliberation is mocked with manually-resolved
// promises so the ordering is deterministic.

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AggregateResult } from "../lib/aggregate.js";
import { DevLoginController } from "./auth.js";
import { useAggregate } from "./hooks.js";
import type { DeliberationConfig } from "./state.js";

const resolvers: ((r: AggregateResult) => void)[] = [];
vi.mock("../lib/aggregate.js", () => ({
  aggregateDeliberation: vi.fn(
    () => new Promise<AggregateResult>((resolve) => resolvers.push(resolve)),
  ),
}));

const configA: DeliberationConfig = {
  mode: "pod",
  deliberation: "https://community.example/a",
  participationFloor: 1,
  ownBase: "https://alice.example/unite/a/",
  participants: [{ webId: "https://alice.example/#me", base: "https://alice.example/unite/a/" }],
};
const configB: DeliberationConfig = {
  mode: "pod",
  deliberation: "https://community.example/b",
  participationFloor: 1,
  ownBase: "https://alice.example/unite/b/",
  participants: [{ webId: "https://alice.example/#me", base: "https://alice.example/unite/b/" }],
};

const fakeResult = (deliberation: string): AggregateResult => ({
  deliberation,
  needs: [],
  resonances: [],
  proposals: [],
  infraProposals: [],
  candidates: [],
  critiques: [],
  visions: [],
  claims: [],
  values: [],
  synthesizable: new Set<string>(),
  verified: [],
  unverified: [],
  errors: [],
});

beforeEach(() => {
  resolvers.length = 0;
});

describe("useAggregate", () => {
  it("auto-loads on mount (no manual refresh needed)", async () => {
    const controller = new DevLoginController();
    const { result } = renderHook(() => useAggregate(configA, controller));
    await waitFor(() => expect(resolvers).toHaveLength(1));
    expect(result.current.loading).toBe(true);
    await act(async () => {
      resolvers[0]?.(fakeResult("auto"));
    });
    expect(result.current.result?.deliberation).toBe("auto");
    expect(result.current.loading).toBe(false);
  });

  it("does NOT aggregate an incomplete pod config (fail-closed)", async () => {
    const controller = new DevLoginController();
    const empty: DeliberationConfig = {
      mode: "pod",
      deliberation: "",
      participationFloor: 1,
      ownBase: "",
      participants: [],
    };
    const { result } = renderHook(() => useAggregate(empty, controller));
    // The auto-load effect ran, but configReady gated the request off.
    await act(async () => {});
    expect(resolvers).toHaveLength(0);
    expect(result.current.result).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("FAILS CLOSED when a demo config names a non-demo deliberation (never network)", async () => {
    const controller = new DevLoginController();
    const bad: DeliberationConfig = {
      mode: "demo",
      deliberation: "https://evil.example/deliberations/apps",
      participationFloor: 1,
      ownBase: "https://evil.example/unite/apps/",
      participants: [
        { webId: "https://evil.example/#me", base: "https://evil.example/unite/apps/" },
      ],
    };
    const { result } = renderHook(() => useAggregate(bad, controller));
    await waitFor(() => expect(result.current.error).toMatch(/demo mode requires/));
    // aggregateDeliberation was NEVER invoked — no fetch fell through to the network.
    expect(resolvers).toHaveLength(0);
  });

  it("drops an out-of-order (older) response, keeps the newer one", async () => {
    const controller = new DevLoginController();
    const { result } = renderHook(() => useAggregate(configA, controller));
    await waitFor(() => expect(resolvers).toHaveLength(1)); // auto-load

    await act(async () => {
      void result.current.refresh(); // request 2 → resolvers[1]
      void result.current.refresh(); // request 3 → resolvers[2]
    });
    expect(resolvers).toHaveLength(3);

    await act(async () => {
      resolvers[2]?.(fakeResult("newest")); // newest resolves first
      resolvers[1]?.(fakeResult("older")); // older resolves late — must be dropped
      resolvers[0]?.(fakeResult("auto")); // the superseded auto-load — dropped too
    });

    expect(result.current.result?.deliberation).toBe("newest");
  });

  it("invalidates an in-flight request when the config changes", async () => {
    const controller = new DevLoginController();
    const { result, rerender } = renderHook(
      ({ config }: { config: DeliberationConfig }) => useAggregate(config, controller),
      { initialProps: { config: configA } },
    );
    await waitFor(() => expect(resolvers).toHaveLength(1)); // auto-load under A

    rerender({ config: configB }); // config changes while request in flight
    await waitFor(() => expect(resolvers).toHaveLength(2)); // auto-load under B

    await act(async () => {
      resolvers[0]?.(fakeResult("stale-A")); // resolves under the OLD config
    });
    expect(result.current.result).toBeNull(); // stale result dropped

    await act(async () => {
      resolvers[1]?.(fakeResult("fresh-B"));
    });
    expect(result.current.result?.deliberation).toBe("fresh-B");
    expect(result.current.loading).toBe(false); // not stuck loading
  });
});
