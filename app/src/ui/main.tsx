// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Root bootstrap: ThemeProvider (outside the auth seam) → AuthProvider (the
// injected LoginController) → the active SURFACE (App = v1, V2App = v2).
//
// Auth wiring (decisions/0001): a PRODUCTION build wires the REAL reactive-auth
// controller (`buildController` in ./controller — @jeswr/solid-elements/auth over
// @solid/reactive-authentication + session-restore + DPoP); a DEV build uses the
// dev stub against a local Solid server. Nothing in App/views changes — the seam
// is the injected LoginController, so both paths flow through the same interface.
//
// The SURFACE dimension (design/v2 07 §2): one build serves both surfaces.
// The v1 path below is UNCHANGED from before the v2 surface existed; the v2
// surface loads through a dynamic import (its chunk is never evaluated under
// v1) and FAILS CLOSED to the v1 tree if it cannot load.

import { ThemeProvider } from "@jeswr/app-shell";
import "@jeswr/app-shell/styles.css";
import type { LoginController } from "@jeswr/solid-elements/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { resolveSurface } from "../scope/surface.js";
import { App } from "./App.js";
import { AuthProvider, makeDefaultController, UnconfiguredLoginController } from "./auth.js";
import "../styles.css";

/**
 * Select the runtime controller. DEV → the dev stub (local Solid server); PROD →
 * the real reactive-auth controller, loaded by a DYNAMIC import so the browser-only
 * auth stack (and its custom-element registration side effects) is neither loaded
 * nor evaluated in a DEV build. The dynamic import AND construction are both inside
 * the try, so a broken production auth environment FAILS CLOSED to the unconfigured
 * controller rather than crashing at module-evaluation time.
 */
async function resolveController(): Promise<LoginController> {
  if (import.meta.env.DEV) return makeDefaultController();
  try {
    const { buildController } = await import("./controller.js");
    return buildController();
  } catch (e) {
    console.error("unite: production auth wiring failed — failing closed.", e);
    return new UnconfiguredLoginController();
  }
}

// Resolved once at load, exactly like the scope. Fail-closed to v1: the v1
// surface renders unless something explicitly, validly selects v2.
const SURFACE = resolveSurface({
  hostname: typeof window === "undefined" ? null : window.location.hostname,
  search: typeof window === "undefined" ? null : window.location.search,
  env: import.meta.env.VITE_UNITE_SURFACE as string | undefined,
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");

/** The shared providers around whichever surface is active. */
function shell(controller: LoginController, surface: React.ReactNode): React.JSX.Element {
  return (
    <StrictMode>
      <ThemeProvider storageKey="app-shell-theme">
        <AuthProvider controller={controller}>{surface}</AuthProvider>
      </ThemeProvider>
    </StrictMode>
  );
}

resolveController().then(async (controller) => {
  const root = createRoot(rootEl);
  if (SURFACE.id === "v2") {
    try {
      const { V2App } = await import("../v2/V2App.js");
      root.render(shell(controller, <V2App />));
      return;
    } catch (e) {
      console.error("unite: the v2 surface failed to load — falling back to v1.", e);
    }
  }
  root.render(shell(controller, <App />));
});
