// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Regression tests for the aggregation stale-guard: an out-of-order response
// must not clobber a newer one, and a config change must invalidate an in-flight
// request. aggregateDeliberation is mocked with manually-resolved promises so
// the ordering is deterministic.

import { act, renderHook } from "@testing-library/react";
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
  deliberation: "https://community.example/a",
  ownBase: "https://alice.example/unite/a/",
  participants: [{ webId: "https://alice.example/#me", base: "https://alice.example/unite/a/" }],
};
const configB: DeliberationConfig = {
  deliberation: "https://community.example/b",
  ownBase: "https://alice.example/unite/b/",
  participants: [{ webId: "https://alice.example/#me", base: "https://alice.example/unite/b/" }],
};

const fakeResult = (deliberation: string): AggregateResult => ({
  deliberation,
  needs: [],
  resonances: [],
  verified: [],
  unverified: [],
  errors: [],
});

beforeEach(() => {
  resolvers.length = 0;
});

describe("useAggregate stale-guard", () => {
  it("drops an out-of-order (older) response, keeps the newer one", async () => {
    const controller = new DevLoginController();
    const { result } = renderHook(() => useAggregate(configA, controller));

    await act(async () => {
      void result.current.refresh(); // request 1 → resolvers[0]
      void result.current.refresh(); // request 2 → resolvers[1]
    });
    expect(resolvers).toHaveLength(2);

    await act(async () => {
      resolvers[1]?.(fakeResult("second")); // newer resolves first
      resolvers[0]?.(fakeResult("first")); // older resolves late — must be dropped
    });

    expect(result.current.result?.deliberation).toBe("second");
  });

  it("invalidates an in-flight request when the config changes", async () => {
    const controller = new DevLoginController();
    const { result, rerender } = renderHook(
      ({ config }: { config: DeliberationConfig }) => useAggregate(config, controller),
      { initialProps: { config: configA } },
    );

    await act(async () => {
      void result.current.refresh(); // started under config A → resolvers[0]
    });

    rerender({ config: configB }); // config changes while request in flight

    await act(async () => {
      resolvers[0]?.(fakeResult("stale-A")); // resolves under the OLD config
    });

    expect(result.current.result).toBeNull(); // stale result dropped
    expect(result.current.loading).toBe(false); // not stuck loading
  });
});
