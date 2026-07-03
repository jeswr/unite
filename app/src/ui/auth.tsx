// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The auth seam for the UI. The app talks ONLY to the LoginController interface
// (@jeswr/solid-elements) — the DI boundary between presentation and the
// credential-redeeming machinery. This keeps the app testable + the fetch
// discipline explicit:
//   • controller.authenticatedFetch — the session-bound fetch; used ONLY for the
//     participant's OWN pod writes/reads.
//   • controller.publicFetch        — the pristine credential-free fetch; used for
//     FOREIGN participant pods (aggregation) so a session token never leaks
//     cross-origin.
//
// PRODUCTION wiring (follow-up): construct the real controller with
// `createReactiveAuthController` from `@jeswr/solid-elements/auth` (browser-only
// dynamic import) — it wires @solid/reactive-authentication +
// @jeswr/solid-session-restore + DPoP + silent restore. It is injected here via
// context, so nothing in the views changes when the real controller replaces the
// dev stub below.

import type {
  LoginController,
  LoginResult,
  RecentLoginAccount,
  RestoreOutcome,
} from "@jeswr/solid-elements/react";
import { createContext, type ReactNode, useContext } from "react";

/**
 * A DEV-ONLY LoginController. It performs NO real authentication: both fetches
 * are the plain global fetch (no DPoP token, no popup), and `login` simply
 * records a WebID so the write/aggregate flows can be exercised against a local
 * dev pod. NEVER ship this — production injects the reactive-auth controller.
 */
export class DevLoginController implements LoginController {
  #webId: string | null;
  // Credential-free by construction: force `credentials: "omit"` so a foreign
  // (cross-origin, or same-origin) read can never ride cookies/session state.
  readonly publicFetch: typeof fetch = (input, init) =>
    fetch(input, { ...init, credentials: "omit" });

  constructor(webId: string | null = null) {
    this.#webId = webId;
  }

  /** DEV: same as publicFetch — there is no session token to attach. */
  get authenticatedFetch(): typeof fetch {
    return this.publicFetch;
  }

  get webId(): string | null {
    return this.#webId;
  }

  recentAccounts(): RecentLoginAccount[] {
    return this.#webId ? [{ webId: this.#webId, displayName: this.#webId }] : [];
  }

  restore(): Promise<RestoreOutcome> {
    return Promise.resolve(
      this.#webId ? { outcome: "restored", webId: this.#webId } : { outcome: "login" },
    );
  }

  login(webId?: string): Promise<LoginResult> {
    this.#webId = webId ?? this.#webId ?? "https://dev.example/profile/card#me";
    return Promise.resolve({ webId: this.#webId });
  }

  logout(): Promise<void> {
    this.#webId = null;
    return Promise.resolve();
  }
}

/**
 * A FAIL-CLOSED controller for production builds where the real reactive-auth
 * controller is not yet wired (a Stage-1 follow-up, see app/README.md). It never
 * appears signed in: `webId` is null, `login()` REJECTS with a clear message, and
 * both fetches are the plain credential-free fetch. This guarantees a production
 * build can never fake a session with the dev stub.
 */
export class UnconfiguredLoginController implements LoginController {
  // Credential-free by construction: force `credentials: "omit"` so a foreign
  // (cross-origin, or same-origin) read can never ride cookies/session state.
  readonly publicFetch: typeof fetch = (input, init) =>
    fetch(input, { ...init, credentials: "omit" });
  get authenticatedFetch(): typeof fetch {
    return this.publicFetch;
  }
  get webId(): string | null {
    return null;
  }
  recentAccounts(): RecentLoginAccount[] {
    return [];
  }
  restore(): Promise<RestoreOutcome> {
    return Promise.resolve({ outcome: "login" });
  }
  login(): Promise<LoginResult> {
    return Promise.reject(
      new Error(
        "Login is not configured in this build — production auth wiring is a follow-up (see app/README.md).",
      ),
    );
  }
  logout(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * Select the Stage-1 LoginController: the DEV stub in a development build, the
 * fail-closed unconfigured controller otherwise. Production swaps this for
 * `createReactiveAuthController` (decisions/0001) — a one-line change.
 */
export function makeDefaultController(): LoginController {
  return import.meta.env.DEV ? new DevLoginController() : new UnconfiguredLoginController();
}

const AuthContext = createContext<LoginController | null>(null);

/** Inject a LoginController (the dev stub, or a real reactive-auth controller). */
export function AuthProvider({
  controller,
  children,
}: {
  controller: LoginController;
  children: ReactNode;
}): ReactNode {
  return <AuthContext.Provider value={controller}>{children}</AuthContext.Provider>;
}

/** Access the injected LoginController. Throws if used outside an AuthProvider. */
export function useController(): LoginController {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useController must be used within an <AuthProvider>");
  return c;
}
