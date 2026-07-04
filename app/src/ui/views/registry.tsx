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

/**
 * The scope views whose machinery has NOT landed yet — the only ones the
 * PreviewView may render. "proposals" and "room" left this set when S1 landed
 * the proposal layer + Convergence Room v1; the rest leave it with their
 * build-plan phases (S2 / S4 / S5).
 */
export type PreviewViewId = Exclude<ScopeViewId, "proposals" | "room">;

/** What a not-yet-built view WILL be, and which build-plan phase lands it. */
interface PreviewCopy {
  readonly phase: string;
  readonly description: string;
}

// Honest phase previews, verbatim from the build plan
// (docs/SCOPE-DIFFERENTIATION.md §6): an enabled-but-unbuilt view says exactly
// what it will do and when it arrives — the anti-"relabelled poll" discipline.
const PREVIEW_COPY: Readonly<Record<PreviewViewId, PreviewCopy>> = {
  "adoption-board": {
    phase: "S2",
    description:
      "The ratification instrument: a versions × advertisers matrix per governed " +
      "system, built from fedreg:acceptsSpec reads — every cell a re-checkable " +
      "observation. The wire is the ballot box: adoption is measured, never asserted.",
  },
  deck: {
    phase: "S4",
    description:
      "Card-at-a-time claims: resonates / conflicts / unsure, routed toward " +
      "statements your opinion group hasn't assessed that neighbouring groups " +
      "resonated with. No replies anywhere — reactions, not threads.",
  },
  "futures-gallery": {
    phase: "S4",
    description:
      "Whole vision narratives routed by the contact prior: from outside your " +
      "opinion neighbourhood, overlapping your need/value profile — shared needs " +
      "first, the narrative second. Bridging-ranked, never engagement-ranked.",
  },
  "published-futures": {
    phase: "S5",
    description:
      "Signed shared futures and disagreement maps, rendered only with their " +
      "dissent annex, bridging evidence, verified integrity proof and " +
      "method-provenance label.",
  },
};

/**
 * The honest placeholder for an enabled-but-not-yet-built scope view: names
 * what the view will do and the build-plan phase that lands it. Rendered
 * instead of pretending an apps surface is the scope's own machinery.
 */
export function PreviewView({
  view,
  scope,
}: {
  view: PreviewViewId;
  scope: ScopeConfig;
}): React.JSX.Element {
  const copy = PREVIEW_COPY[view];
  return (
    <section className="view">
      <h2 className="view-title">{VIEW_LABELS[view]}</h2>
      <div className="empty">
        <span className="badge">arrives in {copy.phase}</span>
        <span className="empty-title">Not built yet — and not faked</span>
        <p>{copy.description}</p>
        <p className="muted small">
          This surface is part of the {scope.name.replace("Co-designing ", "")} scope build plan
          (docs/SCOPE-DIFFERENTIATION.md, phase {copy.phase}). Until it lands, this scope stays
          honestly labelled a preview rather than rendering the apps machinery under a different
          name.
        </p>
      </div>
    </section>
  );
}
