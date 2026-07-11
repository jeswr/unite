// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The v2 surface's hash routes (design/v2 07 §2): #/commons, #/circle/<id>,
// #/notebook, #/how, #/story/<id> — the same tiny hash-router pattern as
// ui/route.ts, parsed by the v2 surface ONLY (the v1 router is untouched;
// under the v1 surface these hashes fall through to the v1 default view, and
// under the v2 surface any v1/unknown hash falls through to the commons).
// Pure parse helpers + one hook; fail-closed — anything unrecognised resolves
// to the default route, never a throw. A route's <id> is an OPAQUE SELECTOR
// used only to look up a KNOWN circle/story record — it is never fetched,
// never interpolated into a URL.

import { useCallback, useEffect, useState } from "react";

/** The v2 views — stable ids, they appear in URLs. */
export type V2ViewId = "commons" | "circle" | "notebook" | "how" | "story";

/** A parsed v2 route: the view + the optional path id (circle/story only). */
export interface V2Route {
  readonly view: V2ViewId;
  /** The `<id>` path segment for #/circle/<id> and #/story/<id>. */
  readonly id?: string;
}

export const DEFAULT_V2_ROUTE: V2Route = { view: "commons" };

const V2_VIEW_SET: ReadonlySet<string> = new Set(["commons", "circle", "notebook", "how", "story"]);

/** Views that take a path id. */
const PARAM_VIEWS: ReadonlySet<V2ViewId> = new Set<V2ViewId>(["circle", "story"]);

/** Max accepted id-segment length (an id is a selector into known records). */
const MAX_ID_LENGTH = 200;

/**
 * Parse a location.hash ("#/circle/maple", "#/commons", "#commons?x=1") into a
 * {@link V2Route}. Fail-closed: unknown views, malformed ids, and over-long
 * input all resolve to the default route (the commons).
 */
export function parseV2Hash(hash: string | null | undefined): V2Route {
  if (typeof hash !== "string" || hash.length === 0 || hash.length > 512) return DEFAULT_V2_ROUTE;
  let token = hash.startsWith("#") ? hash.slice(1) : hash;
  if (token.startsWith("/")) token = token.slice(1);
  // Split off any query-ish suffix, then take view [+ id] path segments.
  const path = token.split(/[?&]/, 1)[0] ?? "";
  const segments = path.split("/");
  const view = segments[0] ?? "";
  if (!V2_VIEW_SET.has(view)) return DEFAULT_V2_ROUTE;
  const viewId = view as V2ViewId;
  if (!PARAM_VIEWS.has(viewId)) return { view: viewId };
  const rawId = segments[1] ?? "";
  if (rawId.length === 0 || rawId.length > MAX_ID_LENGTH || segments.length > 2) {
    // A param view with no/deep/over-long id is not a route we know.
    return DEFAULT_V2_ROUTE;
  }
  let id: string;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    return DEFAULT_V2_ROUTE;
  }
  return { view: viewId, id };
}

/** The canonical hash for a v2 route. */
export function v2Hash(route: V2Route): string {
  if (route.id !== undefined && PARAM_VIEWS.has(route.view)) {
    return `#/${route.view}/${encodeURIComponent(route.id)}`;
  }
  return `#/${route.view}`;
}

/** The current hash-routed v2 route + a navigate function. */
export function useV2Route(): [V2Route, (r: V2Route) => void] {
  const [route, setRoute] = useState<V2Route>(() =>
    parseV2Hash(typeof window === "undefined" ? null : window.location.hash),
  );

  useEffect(() => {
    if (typeof window === "undefined") return; // non-browser render (SSR/test)
    const onHashChange = () => setRoute(parseV2Hash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((r: V2Route) => {
    if (typeof window !== "undefined") window.location.hash = v2Hash(r);
    setRoute(r);
  }, []);

  return [route, navigate];
}
