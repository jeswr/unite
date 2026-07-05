// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Tiny hash router: views are linkable URLs (#/overview … #/room) so a
// deliberation state can be shared/bookmarked and the browser back button
// works. Pure parse helpers + one hook; fail-closed — anything unrecognised
// resolves to the default view, never a throw. The router is SCOPE-BLIND: it
// parses every known view id; whether a view is ENABLED for the active scope
// is the App's fail-closed guard (ui/views/registry).

import { useCallback, useEffect, useState } from "react";
import type { ScopeViewId } from "../scope/scopes.js";

/** The base views (every scope) — stable ids, they appear in URLs. */
export type BaseView = "overview" | "compose" | "board" | "bridge" | "trust";

/** Every app view: the base five + the scope-enabled extras (S0 seams). */
export type View = BaseView | ScopeViewId;

export const DEFAULT_VIEW: View = "overview";

const VIEW_SET: ReadonlySet<string> = new Set([
  "overview",
  "compose",
  "board",
  "bridge",
  "trust",
  "proposals",
  "room",
  "adoption-board",
  "build",
  "deck",
  "futures-gallery",
  "published-futures",
]);

/** Parse a location.hash ("#/board", "#board", "#/board?x=1") into a View. */
export function parseViewHash(hash: string | null | undefined): View {
  if (typeof hash !== "string" || hash.length === 0 || hash.length > 256) return DEFAULT_VIEW;
  let token = hash.startsWith("#") ? hash.slice(1) : hash;
  if (token.startsWith("/")) token = token.slice(1);
  // Drop anything after a further delimiter (future sub-routes stay parseable).
  token = token.split(/[/?&]/, 1)[0] ?? "";
  return VIEW_SET.has(token) ? (token as View) : DEFAULT_VIEW;
}

/** The canonical hash for a view. */
export function viewHash(view: View): string {
  return `#/${view}`;
}

/** The current hash-routed view + a navigate function (pushes a hash change). */
export function useHashView(): [View, (v: View) => void] {
  const [view, setView] = useState<View>(() =>
    parseViewHash(typeof window === "undefined" ? null : window.location.hash),
  );

  useEffect(() => {
    if (typeof window === "undefined") return; // non-browser render (SSR/test)
    const onHashChange = () => setView(parseViewHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((v: View) => {
    // Setting location.hash fires hashchange, which updates state — one source
    // of truth. Guard for non-browser environments (tests render without it).
    if (typeof window !== "undefined") window.location.hash = viewHash(v);
    setView(v);
  }, []);

  return [view, navigate];
}
