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
(see **Production wiring** below); out of the box a clearly-marked
`DevLoginController` stub lets you exercise the write/aggregate flows against a
local dev pod without a real identity provider.

## What it does (features a–e)

| Feature | View | Data-layer entry |
|---|---|---|
| (a) join a deliberation (membership-gated via the seam) | Join | `StubMembershipVerifier` / `StaticRegistry` |
| (b) submit a need (Max-Neef-classified, to your OWN pod) | Compose | `writeNeed` (`authenticatedFetch`) |
| (c) read the deliberation's aggregated needs | Needs board | `aggregateDeliberation` (`publicFetch`) |
| (d) express resonance on others' needs (to your pod) | Needs board | `writeResonance` (`authenticatedFetch`) |
| (e) bridging view: needs ranked by cross-cluster agreement | Bridging | `rankNeeds` |

**Fetch discipline (the credential-leak boundary):** the session-bound
`authenticatedFetch` is used ONLY for your own pod (writes + own reads); foreign
participant pods are read with the credential-free `publicFetch`, so a session
token can never leak cross-origin.

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

- **Login:** replace `DevLoginController` (`src/ui/auth.tsx`) with
  `createReactiveAuthController` from `@jeswr/solid-elements/auth` (browser-only
  dynamic import) configured with this app's `callbackUri` + a Client Identifier
  Document. Wires `@solid/reactive-authentication` + `@jeswr/solid-session-restore`
  + DPoP + silent restore. The `LoginController` is injected via React context, so
  only that one construction line changes.
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
