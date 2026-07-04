// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Tiny hash router: the four views are linkable URLs (#/overview, #/compose,
// #/board, #/bridge) so a deliberation state can be shared/bookmarked and the
// browser back button works. Pure parse helpers + one hook; fail-closed —
// anything unrecognised resolves to the default view, never a throw.

import { useCallback, useEffect, useState } from "react";

/** The four app views. Stable ids — they appear in URLs. */
export type View = "overview" | "compose" | "board" | "bridge";

export const DEFAULT_VIEW: View = "overview";

const VIEW_SET: ReadonlySet<string> = new Set(["overview", "compose", "board", "bridge"]);

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
