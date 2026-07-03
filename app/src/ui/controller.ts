// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// PRODUCTION login wiring (decisions/0001 follow-up). Wire the real suite auth
// stack — the @jeswr/solid-elements `/auth` adapter over
// @solid/reactive-authentication + @jeswr/solid-session-restore + oauth4webapi +
// dpop — into the LoginController seam <jeswr-login-panel> drives.
//
// BROWSER-ONLY. Imported from main.tsx ONLY, never from the data layer (src/lib)
// or the pure auth seam (auth.tsx). The views + hooks stay fetch-injectable and
// unit-testable with a stubbed controller, so nothing here is on the test path;
// the two pure derivations (client_id / callback URI) are exported + unit-tested
// in node, and buildController() is exercised under jsdom with the auth modules
// mocked.

// Side-effect: registers the <authorization-code-flow> custom element (the popup
// driver). The registration lives in the `/registerElements` subpath — the bare
// package entry does NOT call customElements.define, so importing it would leave
// an HTMLUnknownElement with no getCode and break interactive login.
import "@solid/reactive-authentication/registerElements";
import { createReactiveAuthController } from "@jeswr/solid-elements/auth";
import type { LoginController } from "@jeswr/solid-elements/react";

/** Unique-per-app keys on a shared origin (the /auth subexport contract). */
const DB_NAME = "unite:sessions";
const REMEMBERED_KEY = "unite.remembered-account";
const RECENT_KEY = "unite.recent-accounts";

/** The Client Identifier Document path (served from `public/`). */
export const CLIENT_ID_PATH = "/clientid.jsonld";
/** The OAuth redirect/callback page path (served from `public/`). */
export const CALLBACK_PATH = "/callback.html";
/**
 * The CANONICAL deploy origin. It MUST equal the origin `public/clientid.jsonld`
 * is baked to (its `client_id` + `redirect_uris`) — the Client Identifier
 * Document is a STATIC file, so a static `client_id` requires a fixed origin. The
 * production `client_id` and callback URI are BOTH derived from this one origin
 * (overridable per-deploy via `VITE_APP_ORIGIN`) so they never diverge from the
 * served document. A consistency test asserts the match. (Serving from another
 * origin means regenerating the doc + setting VITE_APP_ORIGIN — see README.)
 */
export const CANONICAL_ORIGIN = "https://unite.jeswr.org";

/** The subset of `import.meta.env` the derivations read (a test seam). */
export interface AuthEnv {
  readonly VITE_CLIENT_ID?: string;
  readonly VITE_APP_ORIGIN?: string;
  /**
   * Extra resource ORIGINS the DPoP token may be attached to — comma/space
   * separated. Needed only for a SPLIT topology where the pod (own container) is
   * served from a different origin than the WebID + issuer (both already allowed
   * by default). Without it, writes to such a pod would 401 (fail-closed).
   */
  readonly VITE_ALLOWED_ORIGINS?: string;
  readonly PROD?: boolean;
  readonly DEV?: boolean;
}

function safeOrigin(value: string): string | undefined {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

/**
 * The origin that owns the effective `client_id` in production. When a specific
 * document is pinned via `VITE_CLIENT_ID`, ITS origin is authoritative (the
 * callback `redirect_uri` must be listed in THAT document); otherwise it is the
 * `VITE_APP_ORIGIN` override, else the canonical origin. `client_id` + callback
 * are ALWAYS derived from this one origin so they can never diverge.
 */
export function clientOrigin(env: AuthEnv): string {
  const pinned = env.VITE_CLIENT_ID?.trim();
  if (pinned) {
    const origin = safeOrigin(pinned);
    if (origin) return origin;
  }
  return env.VITE_APP_ORIGIN?.trim() || CANONICAL_ORIGIN;
}

/**
 * Derive the stable Solid-OIDC `client_id` (a Client Identifier Document URL).
 *
 * Precedence:
 *   1. An explicit `VITE_CLIENT_ID` (pin a specific document — used verbatim).
 *   2. In a PRODUCTION build, `<clientOrigin>/clientid.jsonld` — the SAME origin
 *      the served static document advertises (never the runtime origin, which
 *      could diverge from the static doc on a preview deploy → OIDC failure).
 *   3. Otherwise (dev) `undefined` → dynamic client registration (throwaway), the
 *      only combination that works from `localhost` against a remote IdP.
 */
export function deriveClientId(env: AuthEnv): string | undefined {
  const explicit = env.VITE_CLIENT_ID?.trim();
  if (explicit) return explicit;
  if (env.PROD) return new URL(CLIENT_ID_PATH, clientOrigin(env)).toString();
  return undefined;
}

/**
 * Derive the callback URI. Whenever a `client_id` is in effect (a pinned
 * `VITE_CLIENT_ID`, or any production build), the callback is derived from the
 * SAME `clientOrigin` so it is guaranteed to be listed in the effective Client
 * Identifier Document's `redirect_uris`. In dev with no client_id it is the local
 * runtime origin (dynamic registration allows any callback).
 */
export function deriveCallbackUri(env: AuthEnv, runtimeHref: string): string {
  const hasClientId = Boolean(env.VITE_CLIENT_ID?.trim()) || Boolean(env.PROD);
  const base = hasClientId ? clientOrigin(env) : runtimeHref;
  return new URL(CALLBACK_PATH, base).toString();
}

/** Parse `VITE_ALLOWED_ORIGINS` (comma/space separated) into valid origins. */
export function parseAllowedOrigins(env: AuthEnv): string[] {
  const raw = env.VITE_ALLOWED_ORIGINS?.trim();
  if (!raw) return [];
  const out: string[] = [];
  for (const token of raw.split(/[\s,]+/)) {
    const origin = safeOrigin(token);
    if (origin && !out.includes(origin)) out.push(origin);
  }
  return out;
}

/**
 * Ensure the reactive-auth popup driver (`<authorization-code-flow>`) exists in
 * the DOM, then build the real reactive-auth LoginController. Called ONCE from
 * main.tsx in a production build. `login()` needs the popup driver; silent
 * restore does not — both flow through the returned controller.
 */
export function buildController(): LoginController {
  let authFlow = document.querySelector("authorization-code-flow");
  if (!authFlow) {
    authFlow = document.createElement("authorization-code-flow");
    document.body.append(authFlow);
  }
  const env = import.meta.env as AuthEnv;
  const clientId = deriveClientId(env);
  const allowedOrigins = parseAllowedOrigins(env);
  return createReactiveAuthController({
    // The element implements getCode (the reactive-auth popup contract).
    authFlow: authFlow as unknown as {
      getCode: (uri: URL, signal: AbortSignal) => Promise<string>;
    },
    callbackUri: deriveCallbackUri(env, location.href),
    ...(clientId ? { clientId } : {}), // absent → dynamic registration (dev fallback)
    // Explicit split-topology origins UNION the defaults (WebID + issuer origin),
    // so a pod on a different host than the WebID still authenticates its writes.
    ...(allowedOrigins.length > 0 ? { allowedOrigins } : {}),
    dbName: DB_NAME,
    rememberedAccountsKey: REMEMBERED_KEY,
    recentAccountsKey: RECENT_KEY,
    // Dev CSS over HTTP loopback only; remote issuers stay HTTPS-strict.
    allowInsecureLoopback: Boolean(env.DEV),
  });
}
