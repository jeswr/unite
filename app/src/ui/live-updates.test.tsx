// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The useLiveUpdates hook + deliberationContainers derivation. watchContainers is
// mocked so the test asserts the hook wires the right containers + fetch, re-fires
// the CURRENT onChange, and tears the watcher down on unmount / config change.

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DevLoginController } from "./auth.js";

const { close, watchContainers } = vi.hoisted(() => {
  const closeFn = vi.fn();
  return {
    close: closeFn,
    watchContainers: vi.fn((_opts: Record<string, unknown>) => ({ close: closeFn })),
  };
});
vi.mock("../lib/notifications.js", () => ({ watchContainers }));

import { deliberationContainers, useLiveUpdates } from "./hooks.js";
import type { DeliberationConfig } from "./state.js";

const config: DeliberationConfig = {
  mode: "pod",
  deliberation: "https://community.example/d",
  ownBase: "https://alice.example/unite/d/",
  participants: [
    { webId: "https://alice.example/#me", base: "https://alice.example/unite/d/" },
    { webId: "https://bob.example/#me", base: "https://bob.example/unite/d/" },
  ],
};

describe("deliberationContainers", () => {
  it("derives needs/ + resonances/ per participant", () => {
    expect(deliberationContainers(config)).toEqual([
      "https://alice.example/unite/d/needs/",
      "https://alice.example/unite/d/resonances/",
      "https://bob.example/unite/d/needs/",
      "https://bob.example/unite/d/resonances/",
    ]);
  });

  it("skips a participant with an empty base", () => {
    expect(
      deliberationContainers({ ...config, participants: [{ webId: "https://x/#me", base: "" }] }),
    ).toEqual([]);
  });

  it("watches nothing in demo mode (in-memory pods — no network polling)", () => {
    expect(deliberationContainers({ ...config, mode: "demo" })).toEqual([]);
  });

  it("filters out invalid participants (non-https base / webId / no trailing slash)", () => {
    expect(
      deliberationContainers({
        ...config,
        participants: [
          { webId: "https://ok.example/#me", base: "https://ok.example/u/" }, // valid
          { webId: "https://x.example/#me", base: "http://localhost/u/" }, // http base → skip
          { webId: "http://x.example/#me", base: "https://x.example/u/" }, // http webId → skip
          { webId: "https://x.example/#me", base: "https://x.example/u" }, // no trailing / → skip
        ],
      }),
    ).toEqual(["https://ok.example/u/needs/", "https://ok.example/u/resonances/"]);
  });
});

describe("useLiveUpdates", () => {
  beforeEach(() => {
    watchContainers.mockClear();
    close.mockClear();
  });

  it("subscribes with the derived containers + the controller publicFetch", () => {
    const controller = new DevLoginController("https://alice.example/#me");
    renderHook(() => useLiveUpdates(config, controller, vi.fn()));
    expect(watchContainers).toHaveBeenCalledTimes(1);
    const opts = watchContainers.mock.calls[0]?.[0] as unknown as {
      containers: string[];
      fetch: typeof fetch;
      onChange: () => void;
    };
    expect(opts.containers).toEqual(deliberationContainers(config));
    expect(opts.fetch).toBe(controller.publicFetch);
  });

  it("invokes the CURRENT onChange (via ref) when the watcher fires", () => {
    const controller = new DevLoginController();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useLiveUpdates(config, controller, cb), {
      initialProps: { cb: first },
    });
    const opts = watchContainers.mock.calls[0]?.[0] as unknown as { onChange: () => void };
    // A new callback identity must NOT re-subscribe (ref indirection).
    rerender({ cb: second });
    expect(watchContainers).toHaveBeenCalledTimes(1);
    opts.onChange();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("closes the watcher on unmount", () => {
    const controller = new DevLoginController();
    const { unmount } = renderHook(() => useLiveUpdates(config, controller, vi.fn()));
    unmount();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("does not subscribe when there are no containers", () => {
    const controller = new DevLoginController();
    renderHook(() => useLiveUpdates({ ...config, participants: [] }, controller, vi.fn()));
    expect(watchContainers).not.toHaveBeenCalled();
  });
});
