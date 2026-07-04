// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The S0 view scaffolding: canonical tab order, per-scope enablement, the
// fail-closed view guard, and the honest phase-labelled preview stub.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SCOPE_ORDER, SCOPES, type ScopeViewId } from "../../scope/scopes.js";
import type { View } from "../route.js";
import {
  BASE_VIEWS,
  enabledViews,
  isViewEnabled,
  PreviewView,
  VIEW_LABELS,
  VIEW_ORDER,
} from "./registry.js";

afterEach(cleanup);

describe("view registry", () => {
  it("VIEW_ORDER covers every view exactly once and every view has a label", () => {
    expect(new Set(VIEW_ORDER).size).toBe(VIEW_ORDER.length);
    for (const v of VIEW_ORDER) expect(VIEW_LABELS[v]).toBeTruthy();
    expect(Object.keys(VIEW_LABELS).sort()).toEqual([...VIEW_ORDER].sort());
  });

  it("every scope's enabled views = base ∪ scope.views, in canonical order", () => {
    for (const id of SCOPE_ORDER) {
      const scope = SCOPES[id];
      const enabled = enabledViews(scope);
      // set equality
      expect([...enabled].sort()).toEqual([...new Set([...BASE_VIEWS, ...scope.views])].sort());
      // canonical order preserved
      const indices = enabled.map((v) => VIEW_ORDER.indexOf(v));
      expect(indices).toEqual([...indices].sort((a, b) => a - b));
    }
  });

  it("every scope-declared extra view is a known view id (config can't invent tabs)", () => {
    for (const id of SCOPE_ORDER) {
      for (const v of SCOPES[id].views) expect(VIEW_ORDER).toContain(v);
    }
  });

  it("isViewEnabled: base views everywhere; extras only where declared (fail-closed)", () => {
    for (const id of SCOPE_ORDER) {
      const scope = SCOPES[id];
      for (const v of BASE_VIEWS) expect(isViewEnabled(scope, v)).toBe(true);
      const extras: View[] = [
        "proposals",
        "room",
        "adoption-board",
        "deck",
        "futures-gallery",
        "published-futures",
      ];
      for (const v of extras) {
        expect(isViewEnabled(scope, v)).toBe(scope.views.includes(v as ScopeViewId));
      }
    }
  });

  it("apps' extra tabs are exactly its declared views (S1: proposals + room)", () => {
    expect(enabledViews(SCOPES.apps).filter((v) => !BASE_VIEWS.includes(v))).toEqual(
      SCOPES.apps.views.slice(),
    );
    expect(SCOPES.apps.views).toEqual(["proposals", "room"]);
  });
});

describe("PreviewView (the honest placeholder)", () => {
  it("names the view, its build phase, and what it will do", () => {
    render(<PreviewView view="adoption-board" scope={SCOPES.infrastructure} />);
    expect(screen.getByText("Adoption board")).toBeTruthy();
    expect(screen.getByText(/arrives in S2/)).toBeTruthy();
    expect(screen.getByText(/adoption is measured, never asserted/)).toBeTruthy();
  });

  it("labels every society preview with its phase (S4/S5), never a fake surface", () => {
    for (const [v, phase] of [
      ["deck", "S4"],
      ["futures-gallery", "S4"],
      ["published-futures", "S5"],
    ] as const) {
      const { unmount } = render(<PreviewView view={v} scope={SCOPES.society} />);
      expect(screen.getByText(new RegExp(`arrives in ${phase}`))).toBeTruthy();
      expect(screen.getByText("Not built yet — and not faked")).toBeTruthy();
      unmount();
    }
  });
});
