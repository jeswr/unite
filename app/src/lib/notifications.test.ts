// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Live-updates module: Link-header parse, WebSocketChannel2023 discovery +
// subscribe, and the watchContainers WebSocket-with-poll-fallback state machine.
// Fetch is stubbed and the WebSocket is a fake — no network, deterministic.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  discoverWebSocketService,
  linkHref,
  sameHostHttp,
  subscribeWebSocket,
  WEBSOCKET_CHANNEL_2023,
  type WebSocketLike,
  watchContainers,
} from "./notifications.js";

const DESC_REL = "http://www.w3.org/ns/solid/terms#storageDescription";

// ── linkHref ──────────────────────────────────────────────────────────────────

describe("linkHref", () => {
  it("extracts the href for a matching rel, resolved absolute", () => {
    const header = `</.well-known/solid>; rel="${DESC_REL}"`;
    expect(linkHref(header, DESC_REL, "https://pod.example/c/")).toBe(
      "https://pod.example/.well-known/solid",
    );
  });

  it("handles multiple comma-separated link-values and space-separated rels", () => {
    const header = `<https://a.example/x>; rel="type", <https://pod.example/desc>; rel="a ${DESC_REL}"`;
    expect(linkHref(header, DESC_REL, "https://pod.example/c/")).toBe("https://pod.example/desc");
  });

  it("returns undefined for a missing rel or null header", () => {
    expect(linkHref(`<x>; rel="other"`, DESC_REL, "https://pod.example/")).toBeUndefined();
    expect(linkHref(null, DESC_REL, "https://pod.example/")).toBeUndefined();
  });
});

// ── sameHostHttp ──────────────────────────────────────────────────────────────

describe("sameHostHttp", () => {
  it("accepts same-host same-scheme", () => {
    expect(sameHostHttp("https://pod.example/desc", "https://pod.example/c/")).toBe(true);
    expect(sameHostHttp("http://localhost:3000/desc", "http://localhost:3000/c/")).toBe(true);
  });

  it("rejects a cross-host or an https→http downgrade", () => {
    expect(sameHostHttp("https://evil.example/desc", "https://pod.example/c/")).toBe(false);
    expect(sameHostHttp("http://pod.example/desc", "https://pod.example/c/")).toBe(false);
    expect(sameHostHttp("ftp://pod.example/x", "https://pod.example/c/")).toBe(false);
  });
});

// ── discovery ───────────────────────────────────────────────────────────────

function res(body: string, headers: Record<string, string>, ok = true, status = 200): Response {
  return {
    ok,
    status,
    headers: new Headers(headers),
    text: async () => body,
    json: async () => JSON.parse(body),
    body: null,
  } as unknown as Response;
}

describe("discoverWebSocketService", () => {
  it("HEADs the resource, follows storageDescription, and returns the WS service subject", async () => {
    const desc = `@prefix notify: <http://www.w3.org/ns/solid/notifications#> .
<https://pod.example/.notifications/WebSocketChannel2023/> notify:channelType <${WEBSOCKET_CHANNEL_2023}> .`;
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        return res("", { link: `<https://pod.example/desc>; rel="${DESC_REL}"` });
      }
      return res(desc, { "content-type": "text/turtle" });
    }) as unknown as typeof fetch;

    const service = await discoverWebSocketService(fetchFn, "https://pod.example/c/needs/");
    expect(service).toBe("https://pod.example/.notifications/WebSocketChannel2023/");
  });

  it("returns undefined when no description link is advertised", async () => {
    const fetchFn = vi.fn(async () => res("", {})) as unknown as typeof fetch;
    expect(await discoverWebSocketService(fetchFn, "https://pod.example/c/")).toBeUndefined();
  });

  it("returns undefined when the description advertises no WebSocket channel", async () => {
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "HEAD"
        ? res("", { link: `<https://pod.example/desc>; rel="${DESC_REL}"` })
        : res("<x> <y> <z> .", { "content-type": "text/turtle" }),
    ) as unknown as typeof fetch;
    expect(await discoverWebSocketService(fetchFn, "https://pod.example/c/")).toBeUndefined();
  });
});

// ── subscribe ───────────────────────────────────────────────────────────────

describe("subscribeWebSocket", () => {
  it("POSTs a channel request and returns the wss receiveFrom", async () => {
    const fetchFn = vi.fn(async () =>
      res(JSON.stringify({ receiveFrom: "wss://pod.example/ws/abc" }), {}),
    ) as unknown as typeof fetch;
    const url = await subscribeWebSocket(
      fetchFn,
      "https://pod.example/svc",
      "https://pod.example/c/",
    );
    expect(url).toBe("wss://pod.example/ws/abc");
  });

  it("rejects a non-ws(s) receiveFrom (no scheme downgrade / SSRF)", async () => {
    const fetchFn = vi.fn(async () =>
      res(JSON.stringify({ receiveFrom: "https://evil.example/x" }), {}),
    ) as unknown as typeof fetch;
    expect(
      await subscribeWebSocket(fetchFn, "https://pod.example/svc", "https://pod.example/c/"),
    ).toBeUndefined();
  });

  it("rejects a cross-host receiveFrom (SSRF containment to the service host)", async () => {
    const fetchFn = vi.fn(async () =>
      res(JSON.stringify({ receiveFrom: "wss://evil.example/ws" }), {}),
    ) as unknown as typeof fetch;
    expect(
      await subscribeWebSocket(fetchFn, "https://pod.example/svc", "https://pod.example/c/"),
    ).toBeUndefined();
  });

  it("allows a ws: downgrade ONLY for a loopback dev host", async () => {
    const fetchFn = vi.fn(async () =>
      res(JSON.stringify({ receiveFrom: "ws://localhost:3000/ws" }), {}),
    ) as unknown as typeof fetch;
    expect(
      await subscribeWebSocket(fetchFn, "http://localhost:3000/svc", "http://localhost:3000/c/"),
    ).toBe("ws://localhost:3000/ws");
  });

  it("returns undefined on a non-ok subscribe", async () => {
    const fetchFn = vi.fn(async () => res("", {}, false, 403)) as unknown as typeof fetch;
    expect(
      await subscribeWebSocket(fetchFn, "https://pod.example/svc", "https://pod.example/c/"),
    ).toBeUndefined();
  });
});

// ── watchContainers ─────────────────────────────────────────────────────────

class FakeSocket implements WebSocketLike {
  static instances: FakeSocket[] = [];
  readonly url: string;
  readonly listeners: Record<string, (() => void)[]> = {};
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }
  addEventListener(type: string, cb: () => void): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(cb);
  }
  emit(type: string): void {
    for (const cb of this.listeners[type] ?? []) cb();
  }
  close(): void {
    this.closed = true;
  }
}

describe("watchContainers", () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const liveFetch = () =>
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        return res("", { link: `<https://pod.example/desc>; rel="${DESC_REL}"` });
      }
      if (init?.method === "POST") {
        return res(JSON.stringify({ receiveFrom: "wss://pod.example/ws/1" }), {});
      }
      // GET description doc
      return res(
        `@prefix notify: <http://www.w3.org/ns/solid/notifications#> .
<https://pod.example/svc> notify:channelType <${WEBSOCKET_CHANNEL_2023}> .`,
        { "content-type": "text/turtle" },
      );
    }) as unknown as typeof fetch;

  it("opens a WebSocket and fires onChange on a message", async () => {
    const onChange = vi.fn();
    const watcher = watchContainers({
      containers: ["https://pod.example/c/needs/"],
      fetch: liveFetch(),
      onChange,
      createWebSocket: (u) => new FakeSocket(u),
    });
    await vi.runOnlyPendingTimersAsync();
    expect(FakeSocket.instances).toHaveLength(1);
    FakeSocket.instances[0]?.emit("message");
    expect(onChange).toHaveBeenCalledTimes(1);
    watcher.close();
    expect(FakeSocket.instances[0]?.closed).toBe(true);
  });

  it("does not fire onChange after close()", async () => {
    const onChange = vi.fn();
    const watcher = watchContainers({
      containers: ["https://pod.example/c/needs/"],
      fetch: liveFetch(),
      onChange,
      createWebSocket: (u) => new FakeSocket(u),
    });
    await vi.runOnlyPendingTimersAsync();
    watcher.close();
    FakeSocket.instances[0]?.emit("message");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("falls back to ETag polling when the server advertises no channel", async () => {
    let etag = "v1";
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        // No storageDescription link → no live channel → poll; carry a changing ETag.
        return res("", { etag });
      }
      return res("", {});
    }) as unknown as typeof fetch;
    const onChange = vi.fn();
    const watcher = watchContainers({
      containers: ["https://pod.example/c/needs/"],
      fetch: fetchFn,
      onChange,
      pollIntervalMs: 1000,
    });
    // Let discovery resolve (no channel) → the container is demoted to polling.
    await vi.runOnlyPendingTimersAsync();
    expect(FakeSocket.instances).toHaveLength(0);
    // First poll records the baseline ETag (no change fired yet).
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).not.toHaveBeenCalled();
    // ETag changes → next poll fires onChange.
    etag = "v2";
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(1);
    watcher.close();
  });

  it("fires when a previously-absent container is created (validator appears)", async () => {
    let created = false;
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        // No storageDescription link → poll. No validator until the container exists.
        return created ? res("", { etag: "v1" }) : res("", {}, false, 404);
      }
      return res("", {});
    }) as unknown as typeof fetch;
    const onChange = vi.fn();
    const watcher = watchContainers({
      containers: ["https://pod.example/c/needs/"],
      fetch: fetchFn,
      onChange,
      pollIntervalMs: 1000,
    });
    // Discovery (no link, 404) → demote → immediate baseline records "no validator".
    await vi.runOnlyPendingTimersAsync();
    expect(onChange).not.toHaveBeenCalled();
    // Container created → next poll sees a real validator → fires (the first need).
    created = true;
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(1);
    watcher.close();
  });

  it("baselines EVERY demoted container (a change on the 2nd fires, not just the 1st)", async () => {
    const etagsByUrl: Record<string, string> = {
      "https://pod.example/a/needs/": "a1",
      "https://pod.example/b/needs/": "b1",
    };
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        return res("", { etag: etagsByUrl[url] ?? "x" }); // no link → poll
      }
      return res("", {});
    }) as unknown as typeof fetch;
    const onChange = vi.fn();
    const watcher = watchContainers({
      containers: ["https://pod.example/a/needs/", "https://pod.example/b/needs/"],
      fetch: fetchFn,
      onChange,
      pollIntervalMs: 1000,
    });
    // Both containers demoted → both must record a baseline (no dropped baseline).
    await vi.runOnlyPendingTimersAsync();
    expect(onChange).not.toHaveBeenCalled();
    // Change the SECOND container only → its baseline must have been recorded, so
    // the next poll detects the change.
    etagsByUrl["https://pod.example/b/needs/"] = "b2";
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(1);
    watcher.close();
  });

  it("detects changes on a VALIDATOR-LESS container via a body-listing hash", async () => {
    // The server sends NO ETag / Last-Modified (on HEAD or GET); change detection
    // must fall back to hashing the container listing body.
    let body = "<c> ldp:contains <c/n1> .";
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") return res("", {}); // 200, no link, no validator
      return res(body, { "content-type": "text/turtle" }); // GET listing, no validator
    }) as unknown as typeof fetch;
    const onChange = vi.fn();
    const watcher = watchContainers({
      containers: ["https://pod.example/c/needs/"],
      fetch: fetchFn,
      onChange,
      pollIntervalMs: 1000,
    });
    await vi.runOnlyPendingTimersAsync(); // demote + baseline body-hash
    await vi.advanceTimersByTimeAsync(1000); // same body → no change
    expect(onChange).not.toHaveBeenCalled();
    body = "<c> ldp:contains <c/n1>, <c/n2> ."; // a member added
    await vi.advanceTimersByTimeAsync(1000); // body hash differs → fire
    expect(onChange).toHaveBeenCalledTimes(1);
    watcher.close();
  });

  it("keeps the baseline through a transient 500 (no false refresh)", async () => {
    let broken = false;
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        // No link → poll. A transient 500 must be ignored (baseline kept), so a
        // later return to the SAME etag does not spuriously fire.
        return broken ? res("", {}, false, 500) : res("", { etag: "v1" });
      }
      return res("", {});
    }) as unknown as typeof fetch;
    const onChange = vi.fn();
    const watcher = watchContainers({
      containers: ["https://pod.example/c/needs/"],
      fetch: fetchFn,
      onChange,
      pollIntervalMs: 1000,
    });
    await vi.runOnlyPendingTimersAsync(); // demote + baseline etag "v1"
    broken = true;
    await vi.advanceTimersByTimeAsync(1000); // 500 → ignored (baseline stays "v1")
    broken = false;
    await vi.advanceTimersByTimeAsync(1000); // etag "v1" again == baseline → no fire
    expect(onChange).not.toHaveBeenCalled();
    watcher.close();
  });

  it("re-aggregates (fires once) and demotes to polling when the live socket drops", async () => {
    const onChange = vi.fn();
    const watcher = watchContainers({
      containers: ["https://pod.example/c/needs/"],
      fetch: liveFetch(),
      onChange,
      createWebSocket: (u) => new FakeSocket(u),
      pollIntervalMs: 1000,
    });
    await vi.runOnlyPendingTimersAsync();
    expect(FakeSocket.instances).toHaveLength(1);
    // Socket dies → reconcile fire (catch any change missed while it dropped).
    FakeSocket.instances[0]?.emit("close");
    expect(onChange).toHaveBeenCalledTimes(1);
    // close + error both firing must NOT double-demote / double-fire.
    FakeSocket.instances[0]?.emit("error");
    expect(onChange).toHaveBeenCalledTimes(1);
    watcher.close();
  });

  it("ignores a cross-host storageDescription link (SSRF containment in discovery)", async () => {
    const onChange = vi.fn();
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        // Malicious pod points the description at a foreign host → must be ignored.
        return res("", { link: `<https://evil.example/desc>; rel="${DESC_REL}"`, etag: "v1" });
      }
      return res("", {});
    }) as unknown as typeof fetch;
    const watcher = watchContainers({
      containers: ["https://pod.example/c/needs/"],
      fetch: fetchFn,
      onChange,
      createWebSocket: (u) => new FakeSocket(u),
      pollIntervalMs: 1000,
    });
    await vi.runOnlyPendingTimersAsync();
    // No socket opened (discovery refused the cross-host doc) → polling only.
    expect(FakeSocket.instances).toHaveLength(0);
    // It never GETs the foreign description URL.
    const gotForeign = (fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls.some(
      (c) => String(c[0]).includes("evil.example"),
    );
    expect(gotForeign).toBe(false);
    watcher.close();
  });
});
