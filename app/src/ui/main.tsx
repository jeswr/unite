// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Root bootstrap: ThemeProvider (outside the auth seam) → AuthProvider (the
// injected LoginController) → App.
//
// PRODUCTION wiring (follow-up, decisions/0001): replace the DevLoginController
// with `createReactiveAuthController` from `@jeswr/solid-elements/auth` (a
// browser-only dynamic import) configured with this app's callbackUri +
// Client Identifier Document. Nothing in App/views changes — only this line.

import { ThemeProvider } from "@jeswr/app-shell";
import "@jeswr/app-shell/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { AuthProvider, makeDefaultController } from "./auth.js";
import "../styles.css";

// DEV → the dev stub; production build → a FAIL-CLOSED controller that never
// fakes a session (real reactive-auth wiring is a Stage-1 follow-up).
const controller = makeDefaultController();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider storageKey="app-shell-theme">
      <AuthProvider controller={controller}>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
