<!-- AUTHORED-BY Claude Fable 5 (PSS agent) -->

# unite — platform build-out plan: three scopes, one codebase, live hosting

**Status:** build-out plan (2026-07-04), authored by the PSS agent from the
maintainer's directive: turn the unite design + Stage-1 seed client into a
**live-hosted platform** with three scoped "versions" sharing maximal code.
This plan extends — never redesigns — the founding design
(`design/01…06`) and the Stage-1 implementation decisions
(`decisions/0001`). Open questions for the maintainer are collected in §9 and
mirrored on the tracking issue.

---

## 1. The three scopes — and why they are the design's own stages

| Scope | Name (working) | What is co-designed | Trust demanded | Maps to |
|---|---|---|---|---|
| **A** | **unite / apps** | The suite's **Solid apps** — propose → needs → converge → the agent suite implements → ship → verify-against-needs | highest per-action (specs become running code) but smallest blast radius | design **Stage 1** (`design/05`) — the existing seed client IS this scope |
| **B** | **unite / infrastructure** | The **digital infrastructure and systems underneath** — protocols, vocabularies, federation machinery, server behaviour, the unite spec itself | high: merges change load-bearing shared systems | design **Stage 2** ("standards-based public technology") |
| **C** | **unite / society** | **Society** — the open participatory-democracy core: visions, needs, shared futures feeding government/industry decision-making | broadest participation, *lowest* barrier to speak, strongest sybil/legitimacy machinery on *outputs* | design **Stage 3** (governance input) |

Two structural facts drive everything else:

1. **The scopes are the same machine pointed at different artifact classes.**
   Every scope runs the identical loop — propose → articulate needs/values →
   resonance → opinion mapping → bridging-ranked convergence → endorsed
   synthesis (dissent carried) → execution → verify-against-needs. Only the
   *proposal type*, the *execution engine*, and the *trust thresholds*
   differ: in A the executor is the agent suite building an app; in B the
   executor is a spec change + reference implementation (adoption-ratified per
   `design/04 §2`); in C the "executor" is publication of a signed
   `fut:SharedFuture` to decision-makers.
2. **They are nested and progressive.** A is a special case of B (an app is a
   piece of digital infrastructure with a small blast radius); B is a special
   case of C (infrastructure is one domain of societal co-design). Trust
   requirements *increase* toward A/B for **write/build/merge** actions and
   *decrease* toward C for **voice** actions — the platform must let anyone
   speak in C while only letting verified, accountable builders merge in A/B.
   Progression is also the adoption path: a community graduates A → B → C as
   its convergence metrics, membership verification, and steward structure
   mature (the `design/04 §6` B1–B5 milestones gate any Stage-2/3 claim).

**Naming.** Working names: `apps` / `infrastructure` / `society` (scope ids in
code), rendered "Co-designing Solid apps" / "Co-designing digital
infrastructure" / "Co-designing society". Final naming is maintainer's call
(§9 Q1).

## 2. Shared-code architecture — ONE app, config-driven scope modes

**Decision: a single Vite + React SPA (the existing `app/`) with a
`ScopeConfig` module resolved at runtime, deployed once, addressed by
per-scope hostnames.** Not a monorepo of per-scope shells.

Justification (favouring maximal sharing, per the brief):

- **The delta between scopes is data, not code.** §1: same loop, same views
  (Compose, resonance deck, needs board, bridging, convergence room, proposal
  board), same data layer (`app/src/lib` — model/pod/registry/membership/
  consent/aggregate/ranking/notifications are all scope-agnostic already).
  What varies is copy, the proposal artifact subtype, default
  registries/communities, which surfaces are enabled (the build layer only in
  A/B), and the per-action trust thresholds. That is a **configuration
  record**, and encoding it as three packages would manufacture drift between
  three copies of everything else — the exact failure the suite's cross-app
  UX-parity rule exists to prevent.
- **One build, one deploy, three (or N) faces.** Scope resolves at **runtime**
  from `location.hostname` (with `?scope=` and `VITE_UNITE_SCOPE` overrides,
  precedence: query → env → hostname → default). One Vercel project carries
  all the domains; a single immutable build artifact serves every scope, so a
  security fix ships to all three at once and can never be live in one scope
  and stale in another.
- **Scope modes are how communities work anyway.** Federation-wise a "scope"
  is just a default set of communities/registries + a policy profile. Runtime
  resolution keeps the door open to per-community skins later (a community's
  registry advertising its own scope profile) without a rebuild — decree-free,
  matching `design/04`.
- **Rejected: monorepo of thin shells.** Pros (independent deploy cadence,
  per-scope dependency isolation) don't bind yet: there is one team (the agent
  suite), one release cadence, and zero scope-specific dependencies. If a
  scope ever grows a genuinely divergent surface (e.g. C's decision-maker
  reporting portal), extract *that surface* then — the ScopeConfig seam makes
  the later split cheap; the premature split makes everything now expensive.
- **Rejected: build-time-only scope (three env-var builds).** Works, but
  triples builds/deploys for zero isolation benefit in an SPA whose scope
  differences are UI-level; runtime resolution + hostname is strictly simpler
  on Vercel (one project, several domains) and still allows a build-time pin
  via `VITE_UNITE_SCOPE` for a dedicated single-scope deployment (e.g. a
  partner-hosted society instance).

**What lives where:**

```
app/src/
  lib/        ← scope-agnostic core (unchanged): fut: model, pod I/O, registry,
                membership verification, ODRL consent, aggregation, bridging
  scope/      ← NEW: ScopeId, ScopeConfig, SCOPES record, resolveScope()
                (hostname/query/env precedence, fail-closed to a valid scope)
  ui/         ← shared shell + views; reads the resolved ScopeConfig for copy,
                enabled surfaces, artifact nouns, thresholds
  build/      ← LATER (Phase 3): the agentic build-layer surface (channel
                view over trackers) — enabled only where scope.buildLayer
```

`ScopeConfig` (shipped in this branch, `app/src/scope/scopes.ts`):
`id`, `name`, `tagline`, `description`, `artifactNoun` (what a proposal is
called), `hosts` (hostname prefixes that select it), `buildLayer` (whether the
agentic build surface exists), `minTierToPropose` / `minRoleToBuild`
(governance hooks, §4), `defaultDeliberation` (seed community per scope).

## 3. Hosting — Vercel, one project, per-scope subdomains

- **Platform:** Vercel Hobby (the suite's standing free-deploy preference),
  static Vite SPA — `app/vercel.json` already exists from the deploy prep.
- **Project:** `unite` (root directory `app/`, build `npm run build`, output
  `dist/`). Deploy-on-commit from `main`.
- **Domains** (proposed; maintainer confirms, §9 Q4):
  - `unite.jeswr.org` — umbrella landing + defaults to the **apps** scope
    (the live, working instance today; honest about maturity: A is real,
    B/C progressively unlock)
  - `apps.unite.jeswr.org` → scope A
  - `infra.unite.jeswr.org` → scope B
  - `society.unite.jeswr.org` → scope C
  - Until DNS exists: `unite-<hash>.vercel.app` + `?scope=apps|infrastructure|society`
    (the query override ships in this branch, so the single Vercel URL can
    demo all three scopes immediately).
- **Client ID document:** `app/public/clientid.jsonld` must list every
  production origin's redirect URL (the suite's per-origin-client-id gotcha);
  update when domains land.
- The scope landing chrome shows the three scopes as a progressive ladder
  (A live → B preview → C preview) — never overclaiming which parts run for
  real (the no-public-production-ready-claims directive applies).

## 4. The governance + trust layer (the load-bearing new piece)

Scopes A and B let people (and agents) **change running systems**, so they
need a stronger trust model than C's open participatory layer. The design
already gives us the primitives: identity tiers (`design/02 §5`), ODRL consent
(`design/01`), signed memberships + delegation chains
(`@jeswr/federation-trust`), VCs (`@jeswr/solid-vc`), agent identity
(`@jeswr/solid-agent-card`), PROV accountability (the agentic-solid-vision
stack). This section composes them into a concrete authorisation model.

### 4.1 Two orthogonal axes: identity tier × role

**Identity tiers** (who you verifiably are — unchanged from `design/02 §5` +
`decisions/0001` Q1):

| Tier | Meaning | Mechanism |
|---|---|---|
| **T0** | pseudonymous voice | WebID only |
| **T1** | community-vouched member | `fedtrust:MembershipCredential` — a VC signed by the community authority asserting membership, verified fail-closed against trust anchors (`verifyMembershipCredential`) |
| **T2** | verified unique person | ZK personhood via the solid-vc pluggable proof-suite seam (SPARQ ZK track) — seamed, not yet live |

**Roles** (what you may do — NEW, per deliberation/community, carried as VCs):

| Role | May | Minimum identity tier |
|---|---|---|
| **observer** | read public artifacts | T0 |
| **participant** | compose statements, resonate, critique | scope C: T0 (pseudonymous voice is a G3 requirement); scopes A/B: T1 |
| **builder** | be commissioned to implement an endorsed synthesis; open implementation branches/PRs; commission *agents* (§5) | T1 + a `builder` role credential |
| **reviewer** | approve/reject implementation work against the endorsed spec; their approval is what "counts" toward merge | T1 + a `reviewer` role credential; reviewers of security-critical surfaces should be T2 once T2 exists |
| **steward** | operate a community: issue/revoke role credentials, set thresholds within spec bounds, sign `fut:SharedFuture` outputs | T1, ≥2 per community (no single steward may act alone on revocation or output signing) |

Roles are **scoped credentials**: a VC (same `federation-trust` machinery as
memberships — issuer = the community authority; the role, the community IRI,
and validity window are signed claims) so any conformant implementation can
verify "X is a reviewer in community F" offline against the community's
published trust anchors. No global roles: a steward of the apps community
holds no authority in an infrastructure community.

### 4.2 The trust graph: vouching + delegation chains

- **Vouching (how people acquire roles):** a builder/reviewer credential is
  issued when **N existing holders of that role vouch** (N configurable per
  community; floor: 2 for builder, 2 for reviewer, and vouchers must be
  unaffiliated when affiliation data exists — the `design/04 §3` no-two-org
  quorum logic reused at the individual level). Vouches are themselves signed
  statements in the vouchers' pods (auditable), and the steward's issuance
  credential *references* them — so "why does X hold this role" is a walkable,
  signed graph, not a database row.
- **Delegation chains (how authority reaches agents and sub-communities):**
  `federation-trust` delegation credentials (`issueDelegation` →
  `DelegationLink[]`, verified in `verifyMembershipCredential`'s chain walk,
  fail-closed on `BROKEN_CHAIN`) let a community authority delegate scoped
  issuance — e.g. the apps community delegates "may issue builder credentials
  for repo-family R" to a working-group key. The same chains carry
  human → agent commissioning (§5.3): every agent action traces through a
  signed chain to an accountable human.
- **Revocation:** role credentials are short-lived (default 90 days,
  renewable) so revocation is mostly expiry; immediate revocation = the
  steward publishing a status update the verifiers check (the
  `fedreg:status` lifecycle — memberships already carry it). Two-steward rule
  on revocation (an abuse of revocation is itself a capture vector).

### 4.3 How a decision is authorised (the full chain, concretely)

An implementation lands in scope A/B only when ALL of these signed artifacts
exist — each independently verifiable from pod-hosted data:

1. **An endorsed `fut:SpecSynthesis`** — the convergence output: bridging
   threshold met across clusters, dissent annex attached, Data-Integrity
   signed by ≥2 stewards (`design/03 §4`, `design/05 §1.4`).
2. **A commission** — a builder (human or agent, §5) holds a delegation
   credential naming *that synthesis IRI* as its scope: "build exactly this".
   No blanket "build whatever" delegations: commissions are per-artifact.
3. **The gates** — the suite's engineering discipline (lint/typecheck/test,
   roborev, adversarial verify) recorded as PROV activity bundles; nothing
   about co-design bypasses engineering rigour (`design/05 §1.5`, critique C7).
4. **Reviewer approval** — ≥2 reviewer-credentialed approvals (≥1 must be a
   *different* party than the builder's voucher set — no vouch-then-approve
   loops); security-surface changes additionally require a
   steward-acknowledged security review.
5. **The merge** — recorded with PROV linking 1–4, so an auditor can walk:
   *merged change → approvals → commission → delegation chain → endorsed
   synthesis → the resonance evidence + dissent it rests on*. This is the
   accountable-web-of-agents audit walk applied to governance.

Scope B adds the `design/04 §2` adoption rule on top: a spec change becomes
*Current* only on measured adoption (≥2 implementations + ≥2 communities
advertising it), never on merge alone. Scope C has no merge step; its output
authorisation is the steward-signed `fut:SharedFuture` with mandatory dissent
annex, stratified by identity tier (T1-only cohorts honestly labelled).

### 4.4 Thresholds (defaults; communities may raise, never lower below floor)

| Action | Floor |
|---|---|
| issue builder/reviewer role | 2 unaffiliated vouches + steward signature |
| approve a merge (scope A) | 2 reviewer approvals |
| approve a merge (scope B, wire-artifact/spec) | 2 reviewer approvals + adoption rule for "Current" |
| sign a SharedFuture (scope C) | 2 stewards + published ConvergenceMetrics |
| revoke a credential | 2 stewards |
| change a community's own thresholds | steward rough consensus, recorded with objections carried |

## 5. The agentic "Slack-style build layer" (scopes A + B)

### 5.1 What exists today (researched 2026-07-04, primary sources)

The "delegate software work to agents in a chat channel" pattern is now
mainstream; unite should adopt its interaction grammar and add what none of
these have — verifiable, portable accountability:

| System | The pattern | Source |
|---|---|---|
| **Devin (Cognition)** | tag `@Devin` in any Slack channel/thread with a task; it replies in-thread with progress + questions and returns a PR; `!ask` for quick answers without a full session | [docs.devin.ai/integrations/slack](https://docs.devin.ai/integrations/slack), [Slack marketplace](https://slack.com/marketplace/A06A3TU8H39-devin) |
| **Factory.ai Droids** | role-specialised agents (Code / Knowledge / Reliability Droids) addressed in Slack; discussions become delegated fixes; interface-agnostic (terminal/IDE/Slack/Linear/browser) | [factory.ai/product/slack](https://factory.ai/product/slack), [docs.factory.ai/integrations/slack](https://docs.factory.ai/integrations/slack), [factory.ai/news/factory-is-ga](https://factory.ai/news/factory-is-ga) |
| **OpenAI Codex cloud** | `@Codex` in Slack gathers thread context, runs in an isolated cloud sandbox, replies with a link to the reviewable diff; Linear: assign an issue to Codex / auto-delegate triage rules | [developers.openai.com/codex/integrations/slack](https://developers.openai.com/codex/integrations/slack), [developers.openai.com/codex/integrations/linear](https://developers.openai.com/codex/integrations/linear) |
| **GitHub Copilot coding agent** | assign a GitHub **issue** to Copilot; it plans, opens a PR, checks off a task list, revises on review comments — the issue/PR thread IS the channel | [docs.github.com — start Copilot sessions](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/start-copilot-sessions), [github.blog](https://github.blog/ai-and-ml/github-copilot/assigning-and-completing-issues-with-coding-agent-in-github-copilot/) |
| **Sourcegraph Amp** | agent *threads* are shared team assets by default (workspaces, thread sharing) — the team learns from each other's agent runs | [sourcegraph.com/amp](https://sourcegraph.com/amp) |
| **Tembo / orchestrators** | tag `@Tembo` in Slack/Linear/GitHub; it fans work out to a choice of underlying agents (Claude Code, Codex, Cursor, Amp) | [tembo.io](https://www.tembo.io/blog/top-coding-agent-tools) |
| **Multi-agent frameworks** (AutoGen, CrewAI, Centaur, Fusion) | agents as chat participants with roles; kanban/mission views over per-task worktrees; Slack-native self-hosted team agents | [awesome-agent-orchestrators](https://github.com/andyrewlee/awesome-agent-orchestrators) |

Common grammar: **a channel/thread per unit of work; agents are addressable
participants; commissioning is conversational; the agent reports in-thread;
the deliverable is a reviewable diff; humans hold merge authority.**
Common gap: trust is platform-internal (a Slack workspace membership, a
GitHub seat). None offers **verifiable cross-organisation accountability** —
who authorised this agent, under what policy, traceable by an outside
auditor. That is exactly what the suite's accountable-web-of-agents stack
(agent-card + A2A + ODRL + VC delegation + PROV — the `agentic-solid-vision`
paper and `accountable-agent-runtime`) provides, and it's unite's
differentiator: the build layer is *that stack with a chat UI*.

### 5.2 Channel/thread model (pod-native, no Slack dependency)

- **A channel = a `wf:Tracker`** (the `design/05` implementationTracker; the
  `@jeswr/solid-task-model` shared model, so channels federate into
  solid-issues + Pod Manager for free). One channel per commissioned
  synthesis (scope A: an app build; scope B: a spec change + reference impl).
- **A thread = a `wf:Task`** within the tracker (a feature, a bug, a review
  round). Messages are the suite's canonical chat model
  (`@jeswr/solid-chat-interop` `CanonicalMessage`, `as:inReplyTo` threading) —
  each participant's messages live in *their own pod*, announced to the
  channel inbox (LDN), aggregated by the client exactly like deliberation
  statements. The convergence-room critique thread and the build channel are
  the same machinery.
- **Participants:** trust-tiered humans (§4) + **agents that are first-class,
  labelled participants** — every agent has a `@jeswr/solid-agent-card`
  descriptor (A2A Agent Card + WebID) and its messages carry PROV
  AI-attribution (the chat-interop model already carries this). No agent ever
  posts as a human.
- **Commissioning is conversational but authorised structurally:** addressing
  `@agent build the endorsed synthesis <IRI>` in a channel *drafts* a
  commission; it becomes real only when a builder-credentialed human signs the
  delegation credential (§4.3-2) — the Devin/Codex tag-to-delegate UX, with a
  signature where they have a workspace setting. The A2A layer
  (`@jeswr/solid-a2a`) translates the natural-language ask into the typed RDF
  task; ODRL (`@jeswr/solid-odrl`) expresses what the agent may do (which
  repos, which resource scopes, expiry).
- **Agent reporting:** progress messages in-thread (its pod → channel inbox),
  each carrying a PROV activity bundle IRI; the "checklist PR" UX of Copilot,
  but the checklist items are signed provenance, not UI affordance.
- **Merge:** §4.3 — reviewer approvals in-thread are signed statements;
  the merge event links the whole chain. The audit walk is a *feature of the
  channel UI*: any observer can expand "why was this merged?" into the chain.

### 5.3 Accountability composition (existing packages, no new crypto)

| Concern | Package (all shipped) |
|---|---|
| agent identity + discovery | `@jeswr/solid-agent-card` |
| NL ↔ typed task translation, handshake | `@jeswr/solid-a2a` |
| usage policy on the commission | `@jeswr/solid-odrl` |
| signed commission/delegation chain | `@jeswr/federation-trust` (+ `@jeswr/solid-vc`) |
| chain verification + audit walk (reference) | `accountable-agent-runtime` (the composed 4-phase verifier) |
| message + attribution model | `@jeswr/solid-chat-interop`, `@jeswr/solid-task-model` |
| egress safety in any aggregator | `@jeswr/guarded-fetch` |

### 5.4 Phasing the build layer

1. **Read-only channel view** (client-side): render a tracker + its tasks +
   pod-hosted messages as a channel; show agent-attribution labels. No new
   server surface.
2. **Posting** (participant messages to own pod + LDN announce) + the
   commission-drafting flow (unsigned drafts).
3. **Signed commissions + the audit-walk expander** (verify chains
   client-side with `verifyMembershipCredential`/the runtime verifier).
4. **A live commissioned agent** — the @jeswr agent suite itself takes a
   commission end-to-end on a real co-designed app (Stage-1 exit-criterion
   material). Requires maintainer-side wiring (which agent runtime, where it
   runs) — flagged §9 Q3.

## 6. What this branch ships (the concrete start)

- `docs/PLATFORM-PLAN.md` — this plan.
- `app/src/scope/` — the ScopeConfig module: `ScopeId`/`ScopeConfig`/`SCOPES`
  + `resolveScope(hostname, search, env)` with query → env → hostname →
  default precedence, fail-closed to `apps` on anything unrecognised/hostile;
  exhaustively unit-tested.
- Scope-aware shell: the app header + a scope navigation strip render from
  the resolved config (the three scopes cross-link via `?scope=` so a single
  Vercel deploy demos all three today); B/C surfaces show honest
  "progressively unlocking" landing copy, A remains the working Stage-1
  deliberation client.
- Gate green (lint / typecheck / vitest / build) — no dependency changes.

## 7. Build phases after this branch (for the builder agents)

| Phase | Work | Depends on |
|---|---|---|
| 1 | Vercel project + domains live; clientid.jsonld origins; landing polish | maintainer: DNS + domain pick (§9) |
| 2 | Role credentials: extend the membership verifier seam to role verification (builder/reviewer/steward VCs via federation-trust); steward issuance UI (My-pod surface) | nothing (packages shipped) |
| 3 | Build-layer read-only channel view (tracker+tasks+messages over task-model + chat-interop) | Phase 2 for labels |
| 4 | Posting + commission drafting; signed commissions + audit walk | 2, 3 |
| 5 | Scope B machinery: spec-change proposal type + adoption-rule status surface (`fedreg:acceptsSpec` reading) | 2 |
| 6 | First live commissioned agent build through the full loop | 4 + maintainer wiring |
| 7 | Scope C hardening: tier stratification surfaces, ConvergenceMetrics publication, SharedFuture signing UI | 2 |

## 8. Security posture

- All §4/§5 verification is **fail-closed** (unknown scope → default;
  unverifiable credential → no role; broken chain → no commission), reusing
  the audited `federation-trust` verifier — no bespoke crypto or RDF parsing.
- Every cross-origin fetch in aggregation/channel views goes through the
  existing guarded pod-scope discipline (`@jeswr/guarded-fetch` podScope —
  just hardened on main).
- Credentials never in URLs/logs; agent tokens never in the browser (agents
  run server-side under their own keys; the client only *verifies*).
- The scope module is pure/deterministic; hostname parsing never trusts
  user-controlled headers beyond `location` (an SPA reading its own origin).

## 9. Open questions for the maintainer (mirrored on the tracking issue)

1. **Naming + boundaries** of the three scopes (`apps`/`infrastructure`/
   `society`?) and whether the umbrella landing defaults to A (live today) or
   a neutral chooser.
2. **Governance floors** (§4.4): are 2-vouch/2-approve/2-steward the right
   floors? Who are the initial stewards besides the maintainer?
3. **Build-layer scope**: model the UX on Devin/Codex-style tag-to-commission
   (recommended) vs GitHub-issue-assignment-style? And which agent runtime
   takes the first live commission (the @jeswr suite via what harness)?
4. **Hosting/domains**: `unite.jeswr.org` + `apps./infra./society.` subdomains
   OK? (Needs DNS; Vercel project creation the orchestrator can do.)
5. **Build order**: plan proposes Phases 1–2–3 first (live hosting, roles,
   read-only channels). Reorder?
