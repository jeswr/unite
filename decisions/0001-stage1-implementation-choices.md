<!-- AUTHORED-BY Claude Fable 5 (PSS agent) -->

# 0001 — Stage-1 implementation choices

> **These are proceed-and-document decisions** per the standing rule (do not
> block on a design/judgment greenlight — proceed with the best choice, document
> it, the maintainer steers after the fact). They are posted for after-the-fact
> steer on
> [full-solid-ecosystem#15](https://github.com/jeswr/full-solid-ecosystem/issues/15).
> The design docs (`design/01`, `design/03`, `design/05`) are the spec; nothing
> here redesigns them — this records the concrete build choices they leave open.

## Stage-1 answers to the three open questions (proceed-and-document)

### Q1 — Personhood / ZK strategy: the pragmatic tier ladder (T1 now, T2 seamed)

The Stage-1 participation gate is **WebID + a `fedtrust:MembershipCredential`**
(design tier **T1, community-vouched**): a participant deliberates in a
federation whose operator/community vouches their membership, giving
one-person-one-voice *within that federation's trust boundary*. Rationale: it is
buildable today on the shipped stack (`@jeswr/federation-trust` VCs over
`fedreg:` memberships), it matches Stage-1 stakes (app specs, not public
policy), and design/02 §5 already requires per-tier metric stratification, so
T1-only cohorts are honestly labelled rather than silently weaker.

ZK personhood (**T2**) is the documented upgrade path, not a Stage-1 dependency:
the gate is a swappable seam (a `MembershipVerifier` interface —
`verify(webId, deliberation) → { ok, tier }`), so a T2 provider drops in without
touching deliberation/aggregation code. Intended provider: the **SPARQ ZK
track**, plugged in via the `@jeswr/solid-vc` pluggable proof-suite seam
(identity-blind unique-human credentials). Until a T2 provider exists, nothing
in Stage 1 may claim sybil-resistance beyond the vouching community's diligence
— ConvergenceMetrics report participation per tier, per the design.

Dev mode uses a stubbed verifier (explicit allowlist, fail-closed — an unlisted
WebID is rejected, never defaulted in), clearly marked dev-only.

### Q2 — Psychology-expert recruitment: out of agent hands; instrument built to be reviewable

Recruiting experts is a human/institutional action (the standing ask: the ODI
network; Fishkin's Center for Deliberative Democracy; the Computational
Democracy Project). What the build CAN do is make the co-design instrument
expert-reviewable: every psychologically load-bearing choice in the MVP (the
Max-Neef need scheme as the elicitation frame, tri-state resonance with the
optional dimension qualifier, distribution-always-visible presentation, the
no-replies resonance surface) is implemented exactly as specified in design/03
with its literature grounding, and enumerated in an EXPERT-REVIEW checklist in
the app docs mapping each UI element → the design-doc section → the open
validation question an expert should judge. The recruitment ask stays recorded
on the needs:user board.

### Q3 — Independent second implementation: adoption-phase requirement, not Stage-1

B2 (an organisationally independent second implementation) remains an exit
criterion for any Stage-2 / "decentralised" claim, per design/04–05 — it is NOT
a Stage-1 build-time gate. Stage-1's job is to make B2 *measurable*: ship the
conformance fixture set (golden `fut:` resources; a scripted deliberation with
expected clusters, expected scores, and expected ranking — the characterization
fixtures in the app's test suite are the seed of this) so that "independent
implementation" = "passes the fixtures". Until B2 is met the project
self-describes as "bootstrapping", never "decentralised".

## Implementation decisions

Concrete choices made building the Stage-1 seed client (`app/`), each with a
one-line rationale. These are the "which is best?" calls the spec leaves to the
implementation.

### Ranking / convergence math (design/03 §0 + §3)

- **Bridging score = Pol.is group-informed-consensus, Laplace-smoothed.** Per
  cluster `g`: `P(resonate|g) = (resonates_g + 1) / (seen_g + 2)`; the
  statement score is the **product** over clusters of size ≥ `minClusterSize`.
  *Rationale:* the product (not the mean) is what makes a statement rank high
  *only* when it earns positive reception in **every** cluster — the exact
  cross-divide property design/03 §0 requires; Laplace smoothing keeps a sparse
  cluster from producing a degenerate 0 or 1.
- **Clustering = k-means, k=2, deterministic farthest-first init.** First centre
  = the participant vector of maximum L2 norm (ties → lexicographically-least
  participant id); each subsequent centre = the point farthest from its nearest
  chosen centre (same tie-break); ≤50 iterations. *Rationale:* the design cites
  PCA+k-means but the math must be **deterministic and fixture-testable** with no
  novel ML (design/05 §3) — farthest-first removes the random-seed nondeterminism
  of standard k-means init, so the fixture asserts an exact assignment. k=2 is the
  Stage-1 minimum that exhibits the bridging property; k is a parameter for later.
- **Unseen votes are `null`, coerced to `0` only inside clustering.** Resonates =
  +1, Conflicts = −1, Unsure = 0, unseen = `null`. *Rationale:* the bridging
  smoothing must distinguish "unseen" (excluded from `seen`) from "voted Unsure"
  (counted in `seen`), so `null` is preserved in the matrix and only zero-filled
  for the geometric k-means step.
- **Ranking ties broken deterministically:** score desc → total `seen` desc →
  statement IRI lexicographic. *Rationale:* a stable, reproducible order is a
  conformance requirement (the fixture asserts full order); no wall-clock or
  insertion-order dependence.
- **Distribution always returned alongside the score.** `rankNeeds` returns the
  per-cluster `{ resonates, conflicts, unsure, seen }` for every statement.
  *Rationale:* design/03 §2 + §6 REQUIRE showing actual distributions, never a
  bare rank — the false-polarisation / perception-gap correction. The UI cannot
  render a bare number even if it wanted to.

### Seams (design/05 §4 — "so no vendor locks in")

- **`MembershipVerifier`** (Q1) — `verify(webId, deliberation)`; ships
  `StubMembershipVerifier` (explicit allowlist, fail-closed). Production =
  `@jeswr/federation-trust` credential verification; T2 = SPARQ-ZK via the
  `@jeswr/solid-vc` proof-suite seam.
- **`DeliberationRegistry`** — `listParticipants()`; ships `StaticRegistry`
  (validated config array). Production = `@jeswr/federation-registry`
  `fedreg:Registry` memberships.
- **Injectable `fetch` everywhere** — no module ever touches `globalThis.fetch`.
  *Rationale:* the credential-leak boundary (the `LoginController` two-fetch
  contract): `authenticatedFetch` only for the participant's own pod;
  `publicFetch` for foreign participant pods. A global patch would blur that
  boundary and is banned in this stack.

### Pod layout (design/01)

- **One resource per statement**, container-per-type under a per-deliberation
  base: `<base>needs/<slug>.ttl` and `<base>resonances/<slug>.ttl`. *Rationale:*
  matches the suite's per-resource LDP convention (solid-task-model, solid-chat-
  interop), lets WAC apply per statement, and makes `ldp:contains` listing the
  natural aggregation primitive.
- **`base` is the participant's unite container for a deliberation**, must end
  `/`, https-only. Writes go through a fail-closed `assertWithinBase` scope guard
  (same origin + path-prefix, reject `..`/encoded-traversal/scheme-relative)
  *before any request*. *Rationale:* a pod-scope guard is the standing suite
  hardening (every integration package); a mis-computed slug must never escape
  the container.
- **Slugs are crypto-random**, never derived from user input. *Rationale:*
  collision-free without read-before-write, and no user string ever reaches a
  URL path (path-injection closed).
- **Cross-pod trust: `dct:creator` must equal the registry WebID.** Aggregation
  keeps only statements whose `dct:creator` matches the participant the pod
  belongs to (per the registry), and one resonance per `(participant, statement)`
  (latest `dct:created` wins). *Rationale:* a pod cannot stuff statements
  attributed to someone else, and one-person-one-voice is enforced at read time,
  not trusted from the write side.

### Dependency pins

- Git deps are **sha-pinned `git+https`** (the #78 keyless-`npm ci` guard):
  `@jeswr/app-shell#e2ad58b`, `@jeswr/solid-elements#2c00745`,
  `@jeswr/solid-session-restore#38e78db`. *Rationale:* `git+ssh` breaks CI/Vercel
  `npm ci`; committed `dist/` in each makes them installable under
  `ignore-scripts=true`.
- npm-published pins: `n3@^2.1.0`, `@jeswr/fetch-rdf@0.1.0`, `@solid/object@0.6.0`,
  `@solid/reactive-authentication@^0.1.3`, `dpop`, `oauth4webapi`. *Rationale:*
  the sanctioned RDF read/write + auth stack; `@solid/object` for typed container
  listing, `n3.Writer` for serialisation (never hand-built triples).

## Follow-ups (tracked, not in Stage-1 scope)

- Production membership wiring: `@jeswr/federation-trust` `MembershipVerifier`
  implementation over `fedtrust:MembershipCredential`.
- Production registry wiring: `@jeswr/federation-registry` `DeliberationRegistry`
  over `fedreg:Registry`.
- Live updates: `solid-notifications` (WebSocketChannel2023) subscription so the
  needs board / bridging view refresh without polling.
- ODRL consent panel: `@jeswr/solid-odrl` author + evaluate the per-statement
  use-policies (design/01 consent layer) — Stage-1 writes conservative defaults
  implicitly; the panel is deferred.
- SHACL profile + vocab PR: author `futures.shacl.ttl` + the OWL sector and PR
  into `solid-federation-vocab/sectors/futures/`; pin via `fedreg:acceptsSpec`.
- Conformance-fixture extraction: promote the ranking characterization fixture +
  the golden `fut:` resources into the design's executable interop-fixture set
  (design/05 §6) — the seed of B2's "passes the fixtures" definition.
