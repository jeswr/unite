// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Live deliberation updates over the Solid Notifications Protocol
// (WebSocketChannel2023) with a POLL FALLBACK. Aggregation already re-reads the
// participant pods (aggregate.ts); this module just TRIGGERS a re-aggregation
// when a watched container changes, so the board + bridging views stay live
// without manual refresh.
//
// BEST-EFFORT by design (notifications are an OPTIONAL server capability):
//   • Per container, try discover → subscribe → open a WebSocket. On a
//     notification frame, fire onChange().
//   • If discovery/subscribe fails, or a live socket drops, the container FALLS
//     BACK to ETag polling (HEAD + compare) on an interval. Nothing throws to
//     the caller; a fully offline server simply polls.
//
// The fetch is INJECTED (never globalThis.fetch): pass the credential-free
// publicFetch for FOREIGN participant containers — consistent with the read
// path in aggregate.ts (the cross-origin credential-leak boundary). The
// WebSocket carries its own short-lived auth from the subscription response, so
// it is a plain browser socket (a test seam via createWebSocket).

import { parseRdf } from "@jeswr/fetch-rdf";
import { DataFactory } from "n3";
import { DEFAULT_MAX_BODY_BYTES, readBodyCapped } from "./pod.js";

const { namedNode } = DataFactory;

/** The Solid Notifications vocabulary + the WebSocketChannel2023 type IRI. */
const NOTIFY = "http://www.w3.org/ns/solid/notifications#";
export const WEBSOCKET_CHANNEL_2023 = `${NOTIFY}WebSocketChannel2023`;
const NOTIFY_CHANNEL_TYPE = `${NOTIFY}channelType`;
/** The `storageDescription` / `describedby` discovery link relations. */
const STORAGE_DESCRIPTION_REL = "http://www.w3.org/ns/solid/terms#storageDescription";
const DESCRIBED_BY_REL = "describedby";
/** The JSON-LD context for a subscription request body. */
const NOTIFICATIONS_CONTEXT = "https://www.w3.org/ns/solid/notifications-context/v1";

/** A cheap deterministic FNV-1a hash (hex) — change detection only, not security. */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/** The minimal WebSocket surface this module uses (the browser WebSocket fits). */
export interface WebSocketLike {
  addEventListener(type: "message" | "close" | "error" | "open", listener: () => void): void;
  close(): void;
}

/** A live-updates handle. Call {@link Watcher.close} to tear everything down. */
export interface Watcher {
  close(): void;
}

/** Options for {@link watchContainers}. */
export interface WatchOptions {
  /** The container URLs to watch (each participant's needs/ + resonances/). */
  readonly containers: readonly string[];
  /** The read fetch — publicFetch for foreign containers (credential-free). */
  readonly fetch: typeof fetch;
  /** Called (coalesced by the caller's own refresh guard) when a container changes. */
  readonly onChange: () => void;
  /** WebSocket factory; defaults to the global WebSocket. Test seam. */
  readonly createWebSocket?: (url: string) => WebSocketLike;
  /** Poll interval (ms) for containers with no live channel. Default 20s. */
  readonly pollIntervalMs?: number;
  /** Max bytes read from a storage-description document. */
  readonly maxBytes?: number;
}

/**
 * Extract the first `href` for a given link relation from an HTTP `Link` header,
 * resolved absolute against `base`. Returns undefined when absent. (A small,
 * tolerant parser — the header is `<uri>; rel="a b"`, comma-separated.)
 */
export function linkHref(header: string | null, rel: string, base: string): string | undefined {
  if (!header) return undefined;
  // Split on commas that separate link-values (each begins with `<`).
  for (const part of header.split(/,(?=\s*<)/)) {
    const m = /<([^>]*)>\s*;\s*(.*)$/s.exec(part.trim());
    if (!m) continue;
    const href = m[1];
    const params = m[2] ?? "";
    const relMatch = /rel\s*=\s*"?([^";]+)"?/i.exec(params);
    const relValue = relMatch?.[1];
    if (!relValue || !href) continue;
    const rels = relValue.trim().split(/\s+/);
    if (rels.includes(rel)) {
      try {
        return new URL(href, base).toString();
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/**
 * True iff `candidate` is an http(s) URL on the SAME HOST as `base` with NO scheme
 * downgrade: an `https:` container keeps discovery/subscription on `https:` (an
 * `http:` container — dev/loopback — stays http). Blocks a hostile pod from
 * downgrading an https topic to plain http (mixed-content / MITM surface).
 */
export function sameHostHttp(candidate: string, base: string): boolean {
  const c = safeUrl(candidate);
  const b = safeUrl(base);
  if (!c || !b) return false;
  if (c.protocol !== "http:" && c.protocol !== "https:") return false;
  if (b.protocol !== "http:" && b.protocol !== "https:") return false;
  if (c.host !== b.host) return false;
  // No downgrade: https container ⇒ https candidate only.
  if (b.protocol === "https:" && c.protocol !== "https:") return false;
  return true;
}

/**
 * Discover the WebSocketChannel2023 subscription service for a resource:
 * HEAD → storageDescription (or describedby) link → parse the description doc →
 * the subject whose `notify:channelType` is WebSocketChannel2023 is the service
 * URL. Returns undefined when the server advertises no such channel (→ poll).
 *
 * ANTI-SSRF: the description doc URL AND the discovered service URL are
 * participant-controlled, so BOTH are constrained to the SAME HOST as the watched
 * container (the pod we are already reading). A malicious pod therefore cannot
 * make the app fetch/POST to localhost, a private host, or an arbitrary third
 * party — the whole chain stays on the pod's own host.
 */
export async function discoverWebSocketService(
  fetchFn: typeof fetch,
  resourceUrl: string,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<string | undefined> {
  let head: Response;
  try {
    head = await fetchFn(resourceUrl, { method: "HEAD" });
  } catch {
    return undefined;
  }
  const linkHeader = head.headers.get("link");
  const descUrl =
    linkHref(linkHeader, STORAGE_DESCRIPTION_REL, resourceUrl) ??
    linkHref(linkHeader, DESCRIBED_BY_REL, resourceUrl);
  // Fail-closed: only follow a description doc on the container's own host.
  if (!descUrl || !sameHostHttp(descUrl, resourceUrl)) return undefined;

  let desc: Response;
  try {
    desc = await fetchFn(descUrl, {
      headers: { accept: "text/turtle, application/ld+json;q=0.9" },
    });
  } catch {
    return undefined;
  }
  if (!desc.ok) return undefined;
  let dataset: Awaited<ReturnType<typeof parseRdf>>;
  try {
    const text = await readBodyCapped(desc, maxBytes);
    dataset = await parseRdf(text, desc.headers.get("content-type"), { baseIRI: descUrl });
  } catch {
    return undefined;
  }
  for (const q of dataset.match(
    null,
    namedNode(NOTIFY_CHANNEL_TYPE),
    namedNode(WEBSOCKET_CHANNEL_2023),
    null,
  )) {
    // Only accept a service URL on the container's own host (SSRF containment).
    if (q.subject.termType === "NamedNode" && sameHostHttp(q.subject.value, resourceUrl)) {
      return q.subject.value;
    }
  }
  return undefined;
}

function safeUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

/** Max bytes read from a (participant-controlled) subscription response body. */
const SUBSCRIBE_MAX_BYTES = 64_000;

const isLoopbackHost = (host: string): boolean =>
  host === "localhost" || host === "127.0.0.1" || host === "[::1]";

/**
 * Validate a participant-advertised `receiveFrom` against the discovered service
 * URL — the anti-SSRF containment. The channel body is participant-controlled, so
 * a malicious pod could point `receiveFrom` at localhost / a private host / an
 * unrelated third party. Fail-closed unless it is a `wss:` URL on the SAME HOST as
 * the notification service we already reached (a `ws:` downgrade is allowed only
 * for a loopback dev host). Returns the URL string, or undefined.
 */
export function validateReceiveFrom(receiveFrom: unknown, serviceUrl: string): string | undefined {
  if (typeof receiveFrom !== "string") return undefined;
  const u = safeUrl(receiveFrom);
  const svc = safeUrl(serviceUrl);
  if (!u || !svc) return undefined;
  if (u.protocol !== "wss:" && !(u.protocol === "ws:" && isLoopbackHost(u.hostname))) {
    return undefined;
  }
  // Containment: the socket may only target the SAME HOST as the discovered
  // service (the pod we are already reading), never an arbitrary/localhost host.
  if (u.host !== svc.host) return undefined;
  return receiveFrom;
}

/**
 * POST a WebSocketChannel2023 subscription for `topicUrl` to `serviceUrl` and
 * return a validated `receiveFrom` wss:// URL, or undefined on any failure. The
 * response body is participant-controlled, so it is size-capped before parse and
 * the returned URL is host-constrained (see {@link validateReceiveFrom}).
 */
export async function subscribeWebSocket(
  fetchFn: typeof fetch,
  serviceUrl: string,
  topicUrl: string,
): Promise<string | undefined> {
  let res: Response;
  try {
    res = await fetchFn(serviceUrl, {
      method: "POST",
      headers: { "content-type": "application/ld+json" },
      body: JSON.stringify({
        "@context": NOTIFICATIONS_CONTEXT,
        type: WEBSOCKET_CHANNEL_2023,
        topic: topicUrl,
      }),
    });
  } catch {
    return undefined;
  }
  if (!res.ok) return undefined;
  let channel: unknown;
  try {
    channel = JSON.parse(await readBodyCapped(res, SUBSCRIBE_MAX_BYTES));
  } catch {
    return undefined;
  }
  return validateReceiveFrom(
    (channel as { receiveFrom?: unknown } | null)?.receiveFrom,
    serviceUrl,
  );
}

/**
 * Watch a set of containers and fire onChange() when any changes. Per container:
 * try a live WebSocketChannel2023 subscription; fall back to ETag polling if the
 * server advertises no channel or the socket drops. Best-effort; never throws.
 */
export function watchContainers(options: WatchOptions): Watcher {
  const {
    containers,
    fetch: fetchFn,
    onChange,
    createWebSocket = (url) => new WebSocket(url) as unknown as WebSocketLike,
    pollIntervalMs = 20_000,
    maxBytes = DEFAULT_MAX_BODY_BYTES,
  } = options;

  let closed = false;
  const sockets = new Set<WebSocketLike>();
  const pollSet = new Set<string>();
  const etags = new Map<string, string>();
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  // In-flight guard: a slow HEAD must not let interval ticks (or an immediate
  // baseline) overlap and update the ETag baseline out of order. `pendingPoll`
  // remembers a request that arrived mid-pass so it runs after (never dropped).
  let polling = false;
  let pendingPoll = false;
  // Sentinel for "no validator / not yet created" (a 404, or a response with no
  // ETag/Last-Modified). Recorded as a real baseline so a later transition to a
  // real validator (e.g. the FIRST need added to a previously-absent container)
  // fires onChange, instead of being swallowed as a first sighting.
  const NO_VALIDATOR = "\u0000no-validator";

  const fire = () => {
    if (!closed) onChange();
  };

  const ensurePolling = () => {
    if (closed || pollTimer !== undefined || pollSet.size === 0) return;
    pollTimer = setInterval(requestPoll, pollIntervalMs);
  };

  /**
   * Request a poll pass. Coalesces + serializes: if a pass is already in flight it
   * sets a pending flag so the running loop does ANOTHER pass afterwards (so a
   * newly-demoted container's baseline is never dropped, and interval ticks never
   * overlap). No two HEAD passes ever run concurrently.
   */
  const requestPoll = () => {
    if (closed) return;
    if (polling) {
      pendingPoll = true;
      return;
    }
    void runPollLoop();
  };

  const runPollLoop = async () => {
    polling = true;
    try {
      do {
        pendingPoll = false;
        await pollOnce();
      } while (pendingPoll && !closed);
    } finally {
      polling = false;
    }
  };

  /**
   * Compute a change-detection validator for a container whose HEAD carried no
   * ETag/Last-Modified: GET the container listing and hash its body (`body:<hash>`),
   * so a validator-less server's membership changes are still detected. Returns
   * null when the GET fails (keep the prior baseline); NO_VALIDATOR on a 404.
   */
  const bodyValidator = async (container: string): Promise<string | null> => {
    try {
      const res = await fetchFn(container, {
        headers: { accept: "text/turtle, application/ld+json;q=0.9" },
      });
      if (!res.ok) return res.status === 404 ? NO_VALIDATOR : null;
      const validator = res.headers.get("etag") ?? res.headers.get("last-modified");
      if (validator !== null) return validator; // a GET may carry one a HEAD omitted
      return `body:${fnv1a(await readBodyCapped(res, maxBytes))}`;
    } catch {
      return null;
    }
  };

  /** HEAD one container; fire() iff its validator changed since last seen. */
  const pollContainer = async (container: string) => {
    if (closed || !pollSet.has(container)) return;
    try {
      const res = await fetchFn(container, { method: "HEAD" });
      // Only a deliberate 404 ("not yet created") maps to the NO_VALIDATOR
      // sentinel; any OTHER non-OK (500/503/403/…) is a transient error — keep the
      // prior baseline and do NOT fire, so a blip never triggers a false refresh.
      if (!res.ok && res.status !== 404) return;
      let tag = res.headers.get("etag") ?? res.headers.get("last-modified");
      if (tag === null) {
        // A 404 = genuinely absent (NO_VALIDATOR). A 200 with NO validator header —
        // a validator-less server — falls back to a hash of the container listing,
        // so membership changes are still detected instead of stuck forever.
        tag = res.status === 404 ? NO_VALIDATOR : await bodyValidator(container);
        if (closed || !pollSet.has(container)) return;
      }
      if (tag === null) return; // couldn't derive a validator this pass — keep baseline
      const prev = etags.get(container);
      etags.set(container, tag);
      if (prev !== undefined && prev !== tag) fire();
    } catch {
      // transient read failure — keep prior baseline; do not fire.
    }
  };

  const pollOnce = async () => {
    for (const container of pollSet) {
      if (closed) return;
      await pollContainer(container);
    }
  };

  /**
   * Demote a container to ETag polling. `reconcile` = a LIVE socket dropped, so a
   * change may have been missed while it died → fire once to re-aggregate. Always
   * records a baseline ETag IMMEDIATELY (not a full interval later), so the poll
   * loop catches the next change from the demotion moment, not from the first tick.
   */
  const demoteToPolling = (container: string, reconcile = false) => {
    if (closed) return;
    const isNew = !pollSet.has(container);
    pollSet.add(container);
    ensurePolling();
    // Immediate baseline (no fire on first sight): request a poll pass now. It runs
    // at once when idle, or is queued behind the in-flight pass (never dropped), so
    // EVERY newly-demoted container gets its baseline promptly — not a tick later.
    if (isNew) requestPoll();
    if (reconcile) fire();
  };

  const establishLive = async (container: string) => {
    const service = await discoverWebSocketService(fetchFn, container, maxBytes);
    if (closed) return;
    if (!service) {
      demoteToPolling(container);
      return;
    }
    const receiveFrom = await subscribeWebSocket(fetchFn, service, container);
    if (closed) return;
    if (!receiveFrom) {
      demoteToPolling(container);
      return;
    }
    let socket: WebSocketLike;
    try {
      socket = createWebSocket(receiveFrom);
    } catch {
      demoteToPolling(container);
      return;
    }
    sockets.add(socket);
    socket.addEventListener("message", fire);
    let dropped = false;
    const drop = () => {
      if (dropped) return; // close + error can both fire; demote once
      dropped = true;
      sockets.delete(socket);
      // A live socket died → poll from now on AND re-aggregate to catch any change
      // missed while it was dropping.
      demoteToPolling(container, true);
    };
    socket.addEventListener("close", drop);
    socket.addEventListener("error", drop);
  };

  for (const container of containers) {
    void establishLive(container).catch(() => demoteToPolling(container));
  }

  return {
    close() {
      closed = true;
      if (pollTimer !== undefined) clearInterval(pollTimer);
      pollTimer = undefined;
      for (const s of sockets) {
        try {
          s.close();
        } catch {
          // already closed
        }
      }
      sockets.clear();
      pollSet.clear();
    },
  };
}
