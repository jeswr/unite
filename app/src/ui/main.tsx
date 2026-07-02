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
import { AuthProvider, DevLoginController } from "./auth.js";
import "../styles.css";

const controller = new DevLoginController();

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
