// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Root bootstrap: ThemeProvider (outside the auth seam) → AuthProvider (the
// injected LoginController) → App.
//
// Auth wiring (decisions/0001): a PRODUCTION build wires the REAL reactive-auth
// controller (`buildController` in ./controller — @jeswr/solid-elements/auth over
// @solid/reactive-authentication + session-restore + DPoP); a DEV build uses the
// dev stub against a local Solid server. Nothing in App/views changes — the seam
// is the injected LoginController, so both paths flow through the same interface.

import { ThemeProvider } from "@jeswr/app-shell";
import "@jeswr/app-shell/styles.css";
import type { LoginController } from "@jeswr/solid-elements/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
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

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");

resolveController().then((controller) => {
  createRoot(rootEl).render(
    <StrictMode>
      <ThemeProvider storageKey="app-shell-theme">
        <AuthProvider controller={controller}>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>,
  );
});
