// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The view registry — the S0 scope-differentiation view scaffolding
// (docs/SCOPE-DIFFERENTIATION.md §5.3): which views a scope shows, in what
// order, under which label — and an HONEST phase-labelled preview for an
// enabled view whose machinery has not landed yet. Never a silently-missing
// tab, never a relabelled apps surface pretending to be the scope's own.

import type { ScopeConfig, ScopeViewId } from "../../scope/scopes.js";
import type { View } from "../route.js";

/** The base views every scope shows. */
export const BASE_VIEWS: readonly View[] = ["overview", "compose", "board", "bridge", "trust"];

/**
 * The canonical tab order across ALL views. A scope's tab strip is this order
 * filtered to (base ∪ scope.views) — so tabs sit in the same place in every
 * scope and a scope switch never reshuffles what the eye learned.
 */
export const VIEW_ORDER: readonly View[] = [
  "overview",
  "compose",
  "board",
  "proposals",
  "bridge",
  "room",
  "adoption-board",
  "deck",
  "futures-gallery",
  "published-futures",
  "trust",
];

/** Tab labels (plan names — SCOPE-DIFFERENTIATION §3.4 / §4.4). */
export const VIEW_LABELS: Readonly<Record<View, string>> = {
  overview: "Overview",
  compose: "Compose",
  board: "Needs board",
  bridge: "Common ground",
  trust: "Trust",
  proposals: "Proposals",
  room: "Convergence room",
  "adoption-board": "Adoption board",
  deck: "Resonance deck",
  "futures-gallery": "Futures gallery",
  "published-futures": "Published futures",
};

/** The views enabled for a scope, in canonical order (base ∪ scope.views). */
export function enabledViews(scope: ScopeConfig): View[] {
  const enabled = new Set<View>([...BASE_VIEWS, ...scope.views]);
  return VIEW_ORDER.filter((v) => enabled.has(v));
}

/** True iff `view` is enabled for `scope` (the App's fail-closed view guard). */
export function isViewEnabled(scope: ScopeConfig, view: View): boolean {
  return (
    (BASE_VIEWS as readonly string[]).includes(view) || scope.views.includes(view as ScopeViewId)
  );
}

// As of S5, EVERY scope view is built — "published-futures" (the last preview)
// graduated to a real view (ui/views/PublishedFutures) when the signing +
// publication machinery landed. There are no enabled-but-unbuilt scope views, so
// the honest phase-labelled placeholder (the old PreviewView) has no remaining
// subjects and is retired. Should a future phase add a new unbuilt view, restore
// the PreviewView pattern here (a phase-labelled "not built yet — and not faked"
// stub, never a relabelled apps surface) rather than shipping an empty tab.
