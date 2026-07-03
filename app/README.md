<!-- AUTHORED-BY Claude Fable 5 (PSS agent) -->

# unite — Stage-1 MVP seed client

> **Under active development.** This is the Stage-1 app-co-design seed client for
> [unite](../README.md) — NOT a finished product, and explicitly not
> "production-ready". It implements features (a)–(e) of the Stage-1 MVP
> (`design/05-stage1-mvp.md`): join a deliberation, submit a Max-Neef-classified
> need to your own pod, read the deliberation's aggregated needs, express
> tri-state resonance, and view needs ranked by cross-cluster (bridging)
> agreement. No synthesis / Habermas-machine / opinion-map machinery yet.

A vite + React + TypeScript SPA. All logic lives in the exhaustively-tested data
layer (`src/lib`); the views (`src/ui`) are thin over it.

## Run

```sh
npm install          # .npmrc sets ignore-scripts=true → no lifecycle scripts run; git deps carry committed dist/
npm run dev          # vite dev server
npm run build        # tsc --noEmit + vite build
npm test             # vitest (the data-layer suite)
npm run lint         # biome
npm run typecheck    # tsc --noEmit
```

The app talks to a Solid pod through an **injectable `fetch`** (the auth seam),
so it runs against any Solid server. Login is wired behind a `LoginController`
(the DI seam): a **DEV build** uses a clearly-marked `DevLoginController` stub
(exercise the write/aggregate flows against a local dev pod, no identity
provider); a **PRODUCTION build** wires the REAL reactive-auth controller
(`src/ui/controller.ts` — `@jeswr/solid-elements/auth` over
`@solid/reactive-authentication` + `@jeswr/solid-session-restore` + DPoP + silent
restore), loaded by a dynamic import so the browser-only auth stack never loads in
dev and a broken auth environment fails closed. Nothing in the views changes —
both paths flow through the injected `LoginController`.

### Client Identifier Document (Solid-OIDC)

`public/clientid.jsonld` is a **static Client Identifier Document**; its
`client_id` MUST equal its own served URL, so it is baked to a single
**canonical origin** (`CANONICAL_ORIGIN` in `src/ui/controller.ts`, currently
`https://unite.jeswr.org`). Production derives BOTH the `client_id` and the
callback URI from that SAME origin (never the runtime origin, which could diverge
from the static doc on a preview deploy) — a test asserts the derivations match
the served document. To deploy at a different origin: update `public/clientid.jsonld`
(both `client_id` and `redirect_uris`) and set `VITE_APP_ORIGIN` (or pin a specific
document with `VITE_CLIENT_ID`). In dev, no static `client_id` is used → dynamic
client registration (the only combination that works from `localhost`).

## Deploy to Vercel

`vercel.json` (SPA fallback + Client Identifier Document CORS/content-type) is
committed. The app lives in this `app/` subdirectory of the repo, so the Vercel
**Root Directory** must be set to `app`.

**Vercel import settings (2-minute import):**

| Setting | Value |
|---|---|
| Framework Preset | **Vite** |
| Root Directory | **`app`** |
| Build Command | `npm run build` (default) |
| Output Directory | `dist` (default) |
| Install Command | `npm ci` (default; keyless — the lockfile is `git+https`, sha-pinned, no `git+ssh`) |
| Node.js Version | 22.x or 24.x |

`npm ci` needs no npm/GitHub credentials: the five `@jeswr/*` deps resolve over
public `git+https` at pinned SHAs. `.npmrc` sets `ignore-scripts=true`, so no
lifecycle hooks run.

**`vercel.json` does two things** (mirrors `solid-access-manager`): (1) an SPA
rewrite `/((?!assets/).*) → /index.html` so client routes resolve (static files
like `clientid.jsonld`, `callback.html`, and `assets/*` are served by the
filesystem first, so the rewrite only catches unknown app routes); (2) serves
`/clientid.jsonld` as `application/ld+json` with `Access-Control-Allow-Origin: *`
so a Solid IdP on any origin can fetch the Client Identifier Document.

**Environment variables — two scenarios.** The Client Identifier Document is a
STATIC file baked to ONE origin (`CANONICAL_ORIGIN = https://unite.jeswr.org`), so
the deploy origin, `public/clientid.jsonld`, and the derived `client_id` must all
agree. Pick one:

1. **Custom domain `unite.jeswr.org` (recommended — zero config).** Assign the
   domain to the Vercel project. `public/clientid.jsonld` already advertises
   `https://unite.jeswr.org/clientid.jsonld` and `client_id`/callback derive from
   `CANONICAL_ORIGIN`, so **no env vars are needed** and login works out of the box.
   *(Domain assignment is a `needs:user` DNS action.)*

2. **Default `<project>.vercel.app` domain.** The baked canonical origin no longer
   matches, so you MUST both (a) regenerate `public/clientid.jsonld` — set its
   `client_id`, `client_uri`, `redirect_uris`, `post_logout_redirect_uris` to the
   `.vercel.app` origin — and (b) set **`VITE_APP_ORIGIN=https://<project>.vercel.app`**
   in the Vercel project (Production + Preview) so `deriveClientId` /
   `deriveCallbackUri` point at the same origin. Without both, login fails
   (`client_id` won't resolve at the served URL). A committed consistency test asserts
   the doc and the derivations match.

Optional split-topology var (either scenario): `VITE_ALLOWED_ORIGINS` — extra
resource origins the DPoP token may attach to, only when the pod is served from a
different host than the WebID + issuer. `VITE_CLIENT_ID` pins a specific Client
Identifier Document URL verbatim (overrides the origin derivation).

## What it does (features a–g)

| Feature | View | Data-layer entry |
|---|---|---|
| (a) join a deliberation (membership-gated via the seam) | Join | `StubMembershipVerifier` / `StaticRegistry` |
| (b) submit a need (Max-Neef-classified, to your OWN pod) | Compose | `writeNeed` (`authenticatedFetch`) |
| (c) read the deliberation's aggregated needs | Needs board | `aggregateDeliberation` (`publicFetch`) |
| (d) express resonance on others' needs (to your pod) | Needs board | `writeResonance` (`authenticatedFetch`) |
| (e) bridging view: needs ranked by cross-cluster agreement | Bridging | `rankNeeds` |
| (f) **live updates** — the board re-aggregates when a participant container changes | Needs board / Bridging | `useLiveUpdates` → `watchContainers` (WebSocketChannel2023 + poll fallback) |
| (g) **ODRL consent** — attach a usage policy to a need (what may be aggregated / synthesized / quoted / forwarded, + k-anonymity) | Compose | `ConsentPanel` → `writeNeed(consent)` → `consentQuads` (`@jeswr/solid-odrl`) |

**Fetch discipline (the credential-leak boundary):** the session-bound
`authenticatedFetch` is used ONLY for your own pod (writes + own reads); foreign
participant pods are read with the credential-free `publicFetch`, so a session
token can never leak cross-origin. Live-update discovery + subscription use
`publicFetch` too, and are SSRF-contained to the pod's own host.

**Live updates (f)** are best-effort: each participant's `needs/` + `resonances/`
container is watched via the Solid Notifications Protocol (`WebSocketChannel2023`),
falling back to ETag polling where a server advertises no channel or a socket
drops. `receiveFrom` and the whole discovery chain are host-constrained to the pod.

**ODRL consent (g)** stores an `odrl:hasPolicy` policy INLINE in the need's own pod
resource, using the `fut:` consent-action profile
(`fut:aggregate`/`synthesize`/`quoteVerbatim`/`governmentUse` + the `fut:kThreshold`
k-anonymity constraint) — matching the landed futures sector vocabulary. Defaults
are conservative (aggregate + synthesize permitted; quote-verbatim + government-use
prohibited; k=5). Server-side enforcement is a facilitation-service concern (a
follow-up); this is the author's standing consent record.

## EXPERT-REVIEW checklist (design/03 — psychology-informed convergence)

Stage-1's Q2 answer (`decisions/0001`) is: make the co-design instrument
**expert-reviewable**. Every psychologically load-bearing choice below is
implemented exactly as the design specifies; a deliberative-democracy /
social-psychology expert should judge each against its open validation question.

| UI element | Design source | Open validation question for an expert |
|---|---|---|
| **Max-Neef need scheme** as the elicitation frame (Compose concept picker; `fut.ts` nine concepts) | `design/03` §2 (Max-Neef needs/satisfiers) | Do the nine fundamental needs, presented as the classification frame, actually surface *shared needs beneath divergent satisfiers* for real participants — or do they feel abstract / mis-map onto lived concerns? |
| **Tri-state resonance** (resonates / conflicts / unsure), optional dimension qualifier (share / aspire / support) | `design/03` §3 (Pol.is agree/disagree/pass); `design/01` reaction layer | Is tri-state (vs binary) the right granularity, and is the *dimension* qualifier (present condition vs aspiration vs willingness-to-support) understood by participants and worth its added friction? |
| **Distribution always shown** (Bridging view renders the per-cluster resonates/conflicts/unsure bars for every ranked need, never a bare rank) | `design/03` §2 (false polarisation / perception gap — showing the real distribution shrinks the gap) | Does surfacing the *actual* cross-cluster distribution measurably reduce the perception gap in this UI, and is the bar presentation legible / non-misleading? |
| **Bridging ranking** (needs ranked by cross-cluster reception via the Laplace-smoothed group-informed-consensus product, not engagement) | `design/03` §0 (bridging-based ranking; Community Notes) | Does the product-over-clusters bridging objective select genuinely common-ground needs, and are its failure modes (e.g. sparse/under-voted needs pulled toward the neutral prior) acceptable for co-design? |
| **No replies** at the resonance layer (the board has reactions only; no threaded discussion) | `design/03` §3 (Pol.is removes the flame-war surface) | Does removing the reply surface preserve constructive signal while avoiding polarisation, and where do participants feel the *lack* of discussion most? |
| **Per-tier participation** (membership tiers T1/T2; the aggregate reports the vouching tier per participant) | `design/02` §5 / `design/03` §6 (participation stratified by verification tier) | Is honest per-tier labelling sufficient for Stage-1 legitimacy, and what does an expert need to see before a T1-only cohort's output is trustworthy? |

The recruitment of such experts is an out-of-agent-hands `needs:user` action
(`decisions/0001` Q2).

## Production wiring (follow-ups — none are Stage-1 blockers)

The seams are built so production drops in without touching the views:

- **Login:** DONE — a production build wires `createReactiveAuthController` from
  `@jeswr/solid-elements/auth` via `src/ui/controller.ts` (dynamic import; DPoP +
  silent restore + Client Identifier Document; see the "Client Identifier Document"
  section above). The `DevLoginController` remains the DEV-only stub. Remaining
  deploy-time `needs:user`: confirm the canonical origin / domain.
- **Membership (Q1):** replace `StubMembershipVerifier` with a
  `@jeswr/federation-trust` verifier over `fedtrust:MembershipCredential`
  (community-vouched T1). Tier T2 (ZK personhood) plugs into the SAME
  `MembershipVerifier` seam via the `@jeswr/solid-vc` proof-suite (the SPARQ ZK
  track).
- **Registry:** replace `StaticRegistry` with a `@jeswr/federation-registry`
  `fedreg:Registry` participant listing.
- **Live updates:** subscribe to pod changes via `solid-notifications`
  (WebSocketChannel2023) so the board / bridging view refresh without a manual
  Refresh.
- **Consent:** an `@jeswr/solid-odrl` consent panel on Compose (design/01 consent
  layer). Stage-1 writes conservative defaults implicitly.
- **Vocabulary:** author `futures.shacl.ttl` + the OWL sector and PR into
  `solid-federation-vocab/sectors/futures/`; pin via `fedreg:acceptsSpec`.

## Conformance-fixture seed

`src/lib/ranking.test.ts` carries the ranking **characterization fixture** (6
synthetic participants, two clean opinion clusters, five statements, exact
hand-computed cluster assignment + Laplace-smoothed bridging scores + full
ranking order). Per `design/05` §6 this is the seed of the executable
conformance fixture set — "second independent implementation" == "passes these".
