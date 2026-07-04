// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The unite app shell. App chrome from @jeswr/app-shell (ThemeToggle +
// FeedbackButton) + the <jeswr-login-panel> auth seam from @jeswr/solid-elements.
// Hash-routed views (#/overview … #/bridge); everything below is thin over
// src/lib.

import { FeedbackButton, ThemeToggle } from "@jeswr/app-shell";
import { LoginPanel } from "@jeswr/solid-elements/react";
import { useState } from "react";
import { resolveScope, SCOPE_ORDER, SCOPES, scopeHref } from "../scope/scopes.js";
import { useController } from "./auth.js";
import { useAggregate, useLiveUpdates, useTrustProfile } from "./hooks.js";
import { DEFAULT_VIEW, useHashView, type View } from "./route.js";
import { type DeliberationConfig, scopedDefaultConfig } from "./state.js";
import { Bridging } from "./views/Bridging.js";
import { Compose } from "./views/Compose.js";
import { NeedsBoard } from "./views/NeedsBoard.js";
import { Overview } from "./views/Overview.js";
import { enabledViews, isViewEnabled, PreviewView, VIEW_LABELS } from "./views/registry.js";
import { Trust } from "./views/Trust.js";

// One codebase, three nested scope modes (docs/PLATFORM-PLAN.md §1–2).
// Resolved once at load from the SPA's own location (+ optional build pin).
const SCOPE = resolveScope({
  hostname: typeof window === "undefined" ? null : window.location.hostname,
  search: typeof window === "undefined" ? null : window.location.search,
  env: import.meta.env.VITE_UNITE_SCOPE as string | undefined,
});

// The scope's tab strip: base views ∪ the scope-enabled extras, in the
// registry's canonical order (the S0 view seam — SCOPE-DIFFERENTIATION §5.3).
const TABS: { id: View; label: string }[] = enabledViews(SCOPE).map((id) => ({
  id,
  label: VIEW_LABELS[id],
}));

/** The Venn brand mark — the intersection is the point (common ground). */
function BrandMark(): React.JSX.Element {
  return (
    <svg className="brand-mark" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <title>unite</title>
      <circle cx="10" cy="13" r="7.25" fill="none" stroke="var(--u-petrol)" strokeWidth="2.2" />
      <circle cx="16" cy="13" r="7.25" fill="none" stroke="var(--u-gold)" strokeWidth="2.2" />
    </svg>
  );
}

export function App(): React.JSX.Element {
  const controller = useController();
  const [webId, setWebId] = useState<string | null>(controller.webId);
  const [config, setConfig] = useState<DeliberationConfig>(() => scopedDefaultConfig(SCOPE));
  const [routedView, navigate] = useHashView();
  // Fail-closed scope guard: a parseable view id NOT enabled for this scope
  // (e.g. #/deck under apps) renders the default view, never a blank surface.
  const view = isViewEnabled(SCOPE, routedView) ? routedView : DEFAULT_VIEW;
  const aggregate = useAggregate(config, controller);
  // The session's verified standing (tier × roles) — resolved once here, and
  // every view gates off the same profile (Phase 2, PLATFORM-PLAN §4).
  const trust = useTrustProfile(config, webId);
  // Live updates: re-aggregate when any participant container changes
  // (WebSocketChannel2023 with a poll fallback; best-effort; pod mode only).
  useLiveUpdates(config, controller, aggregate.refresh);

  const needCount = aggregate.result?.needs.length;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">unite</div>
            <div className="brand-sub">
              {SCOPE.name}
              {SCOPE.status === "preview" ? " · preview" : ""}
            </div>
          </div>
          {config.mode === "demo" && <span className="badge demo">demo deliberation</span>}
        </div>
        <div className="chrome">
          <FeedbackButton
            repo="jeswr/unite"
            appName="unite"
            appVersion={__APP_VERSION__}
            webId={webId}
          />
          <ThemeToggle />
        </div>
      </header>

      <div className="subheader">
        <nav className="scope-nav" aria-label="unite scopes">
          {SCOPE_ORDER.map((id) => {
            const s = SCOPES[id];
            const loc = typeof window === "undefined" ? null : window.location;
            return (
              <a
                key={id}
                className={id === SCOPE.id ? "scope-link active" : "scope-link"}
                href={scopeHref(id, loc?.search, loc?.hash)}
                title={s.tagline}
                aria-current={id === SCOPE.id ? "page" : undefined}
              >
                {s.name.replace("Co-designing ", "")}
              </a>
            );
          })}
        </nav>
        <div className="login-bar">
          <span className={webId ? "session-chip signed-in" : "session-chip"}>
            <span className="dot" aria-hidden="true" />
            {webId ?? "Not signed in"}
          </span>
          {/* The panel stays mounted (autoRestore needs it); the disclosure only
              controls its visibility so the header stays compact. */}
          <details className="login-pop">
            <summary className="btn">{webId ? "Account" : "Sign in"}</summary>
            <div className="login-pop-panel">
              <LoginPanel
                controller={controller}
                autoRestore={true}
                onSessionChange={(e) => setWebId(e.detail.webId)}
              />
            </div>
          </details>
        </div>
      </div>

      <nav className="tabs" aria-label="unite views">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            className={view === t.id ? "tab active" : "tab"}
            aria-current={view === t.id ? "page" : undefined}
            onClick={() => navigate(t.id)}
          >
            {t.label}
            {t.id === "board" && needCount !== undefined && needCount > 0 && (
              <span className="count">{needCount}</span>
            )}
          </button>
        ))}
      </nav>

      <main className={view === "board" || view === "bridge" ? "content wide" : "content"}>
        {view === "overview" && (
          <Overview
            scope={SCOPE}
            config={config}
            onChange={setConfig}
            webId={webId}
            aggregate={aggregate}
            onNavigate={navigate}
          />
        )}
        {view === "compose" && (
          <Compose
            scope={SCOPE}
            config={config}
            webId={webId}
            trust={trust}
            onComposed={aggregate.refresh}
          />
        )}
        {view === "board" && (
          <NeedsBoard
            scope={SCOPE}
            config={config}
            webId={webId}
            trust={trust}
            aggregate={aggregate}
          />
        )}
        {view === "bridge" && (
          <Bridging scope={SCOPE} config={config} webId={webId} aggregate={aggregate} />
        )}
        {view === "trust" && <Trust config={config} webId={webId} trust={trust} />}
        {/* Scope-enabled extra views not yet built render the honest,
            phase-labelled preview (never a relabelled apps surface). */}
        {(view === "proposals" ||
          view === "room" ||
          view === "adoption-board" ||
          view === "deck" ||
          view === "futures-gallery" ||
          view === "published-futures") && <PreviewView view={view} scope={SCOPE} />}
      </main>

      <p className="footer-note">
        unite · every statement lives in its author's own pod · under active development
      </p>
    </div>
  );
}
