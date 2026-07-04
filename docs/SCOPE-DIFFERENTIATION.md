<!-- AUTHORED-BY Claude Fable 5 (PSS agent) -->

# Scope differentiation: what apps / infrastructure / society each actually DO

**Status:** design (2026-07-04), authored by the PSS agent on the maintainer's
direction that the three scope versions must be **real products, not relabelled
polls** — today only `apps` is live, and `infrastructure` / `society` render the
identical Overview/Compose/NeedsBoard/Bridging machinery with different copy.
This doc specifies what each scope is *for*, the data model, compose flow,
views, and convergence output that differ per scope, what genuinely shares, and
a phased build plan. It **extends — never redesigns** — the founding design
(`design/01…06`), `docs/PLATFORM-PLAN.md` (§1 scopes, §4 governance, §7
phases), and `decisions/0001`. It **composes with** the Phase-2 governance/
trust layer (role credentials, steward issuance — in flight on
`feat/phase2-governance`) by consuming tiers/roles strictly as interfaces
(`minTierToPropose`, role-gated endorsement, steward signing); nothing here
respecifies issuance or vouching.

Open calls for the maintainer are in §8, each with a recommended default per
the proceed-without-greenlight rule, mirrored to
[unite#1](https://github.com/jeswr/unite/issues/1).

---

## 1. The differentiation thesis

PLATFORM-PLAN §1 is right that the scopes are "the same machine pointed at
different artifact classes" — but *pointing the machine* is most of the
product. What is genuinely identical across scopes is the **deliberation
substrate**: needs/satisfiers elicitation, tri-state resonance, opinion-space
mapping, bridging-ranked convergence
(design/03; Ovadya 2022; Small et al. 2021; Wojcik et al. 2022). What must
differ is the **artifact lifecycle wrapped around that substrate** — six
things, per scope:

1. **The compose grammar** — what a contributor is asked for, and what
   evidence a proposal must carry before it may advance.
2. **The artifact state machine** — what states a proposal moves through and
   what moves it.
3. **The cohort partition legitimacy rests on** — whose cross-cutting
   agreement counts (computed opinion clusters everywhere; *stakeholder roles*
   additionally in B; *identity-tier strata* displayed honestly in C).
4. **The endorsement gate** — who may move an artifact past convergence
   (Phase-2 roles/tiers, different floors per scope; PLATFORM-PLAN §4.4).
5. **The output artifact and its ratification** — A: a **build commission**
   executed by the agent suite; B: a **spec-change/adoption decision**
   ratified by *measured adoption on the wire* (design/04 §2), never by the
   room; C: an **advisory synthesis with a mandatory dissent annex**
   (design/01, design/03 §4), signed and handed to human decision-makers.
6. **The executor** — A: the accountable agentic build layer (PLATFORM-PLAN
   §5); B: implementers adopting (or declining) a version; C: **no executor
   at all** — publication *is* the output, institutions decide (critique C8:
   "the system never decides; it describes").

Summary table (normative for the build; details in §2–§4):

| | **A — apps** | **B — infrastructure** | **C — society** |
|---|---|---|---|
| Artifact co-designed | a Solid-app spec | a change to a shared system: spec version, protocol profile, vocabulary, shared service, or governance-of-infrastructure decision | a societal proposal: vision, policy direction, norm, collective priority |
| Proposal class | `fut:AppProposal` ⊑ `wf:Task` (design/01) | **`fut:InfraProposal` ⊑ `wf:Task`** (new, §3.2) | `fut:VisionStatement` → adopted `fut:Claim`s (design/01 — already designed, not yet implemented) |
| Compose grammar | idea + needs it serves (`fut:motivatedBy`) + indirect stakeholders (VSD) | structured: target system, change kind, blast radius by role, breaking/migration, reference implementation | narrative first: vision/life-context, then decomposition into atomic claims + needs + values, each explicitly adopted |
| Evidence to advance | ≥1 adopted need (SHACL, design/01) | + running code (reference impl) before endorsement (design/04 §2) | + author adoption of every derived claim (design/03 §1 consent invariant) |
| Cohort partition | opinion clusters | opinion clusters **+ declared stakeholder roles** (implementer / operator / participant) | opinion clusters **+ identity-tier strata always visible** (design/02 §5) |
| Convergence output | `fut:SpecSynthesis` → **build commission** (signed delegation VC naming the synthesis IRI; PLATFORM-PLAN §4.3) | **`fut:AdoptionDecision`** (new, §3.2) — endorsement is advisory; *Current* status is computed from `fedreg:acceptsSpec` observations | `fut:SharedFuture` + mandatory `fut:DissentRecord` + `fut:ConvergenceMetrics`, ≥2-steward signed, method-provenance labelled |
| Failure output | needs unmet → new round (design/05 §1.6) | non-adoption — the wire says no; disagreement map | **disagreement map as first-class success** (design/03 §4) |
| Build layer | yes | yes (reference impls, migration tooling) | **no** (`buildLayer: false` stands) |
| minTierToPropose | T1 | T1 | **T0** (pseudonymous voice is a G3 requirement) |
| Trust posture | high per-action, small blast radius | high — merges change load-bearing systems; adoption rule is the backstop | lowest barrier to speak, strongest legitimacy machinery on *outputs* (stratify-and-disclose, critique C3/C5) |

**What "preview → live" therefore means:** scope B is live when a person can
propose an infrastructure change, the community can converge on it, and the
*network's actual adoption* of it is visible in the product; scope C is live
when a person can contribute a vision pseudonymously, see claims resonate
across clusters, and a signed shared future (or an honest disagreement map)
with its dissent annex comes out the other end. Neither is "the needs board
with different copy".

---

## 2. Scope A — co-designing Solid apps (the reference lifecycle)

Scope A is live *as a deliberation substrate* but the Stage-1 loop
(design/05 §1) is not yet closed in the app: today's client composes only
`fut:Need`s and `fut:Resonance`s. The artifact lifecycle — propose →
converge → commission → verify-against-needs — is exactly the machinery B and
C specialise, so **completing A builds the shared spine**:

- **Proposal layer.** Compose a `fut:AppProposal` (⊑ `wf:Task`,
  `fut:motivatedBy` ≥1 need — SHACL, design/01) and a **proposal board**
  view (kanban over `wf:Task` state; federates into solid-issues/PM for free
  via `@jeswr/solid-task-model`). The satisfier/need split becomes visible
  product: a proposal is a *satisfier*; the board shows which shared needs
  each proposal serves, and rival proposals for the same need are presented
  as a portfolio, not a conflict (design/03 §2).
- **Convergence Room v1** (design/05 §2's missing screen; design/03 §4's
  loop): candidate synthesis → critique thread (the only threaded surface) →
  bounded revision rounds → cross-cluster endorsement vote against the
  bridging threshold → **dissent annex assembly** → either an endorsed
  `fut:SpecSynthesis` or a published **disagreement map**. This one view is
  reused by all three scopes' output stages (§5).
- **Output = build commission.** On endorsement, the §4.3 chain from
  PLATFORM-PLAN applies unchanged: commission (delegation VC naming *that*
  synthesis IRI) → engineering gates (PROV) → reviewer approvals → merge —
  surfaced in the Phase-3/4 build-channel views. Nothing new to design here;
  this doc just names A's output so B's and C's contrast is exact.
- **Verify-against-needs** (design/05 §1.6): after ship, contributors check
  each `fut:acceptanceCriterion` against their own original need — resonance
  records on criteria, published as open metrics. This is A-specific (it
  needs a shipped app to verify) but its UI (resonance on criteria) is the
  ordinary deck.

---

## 3. Scope B — co-designing digital infrastructure

### 3.1 What the product IS

The deliberative front-end to the **adoption-ratified spec-governance process
that design/04 §2 already defines**. Design/04 specifies how a spec version
becomes *Current* (≥2 independent implementations + ≥2 communities advertising
via `fedreg:acceptsSpec`; the steward circle only recommends). What it does
not provide is the *place where the network deliberates its way to a
proposal* — where needs surface, where implementers/operators/users discover
they disagree, and where the recommendation gets its legitimacy. Scope B is
that place, plus the instrument that makes the ratification **visible**:

> **The wire is the ballot box.** In scope B the room's endorsement is
> explicitly advisory; the product's job is (a) to get proposals *to* a
> well-evidenced, cross-stakeholder-endorsed recommendation, and (b) to show
> honestly, continuously, what the network actually adopted.

This grounding is the IETF's own: rough consensus and running code
(design/04 §2; concretised in RFC 7282, *On Consensus and Humming in the
IETF* — consensus is the absence of unaddressed objections, not a vote count,
which is precisely what the critique-round + dissent-annex loop implements),
and commons governance in Ostrom's sense (*Governing the Commons*, 1990 —
**new citation** beyond the founding set: shared infrastructure is governed
well by nested, polycentric arrangements whose rules the affected parties
participate in setting; the community-sets-thresholds-above-floors design of
PLATFORM-PLAN §4.4 is already Ostrom-shaped, and scope B is where the
affected parties do that participating).

**Initial governed surface (recommended; §8 Q3):** unite's own spec lineage +
the suite's federation sector specs — the things that already carry
`fedreg:acceptsSpec` wiring. Self-hosting, like Stage 1: the first scope-B
deliberation should be the `fut:` 0.2.0 vocabulary change that *enables scope
B itself* (§3.2), executing design/04's process end-to-end — which is
milestone **B4** (first adoption-ratified spec change) run for real, not
simulated. Fediverse-adjacent external technologies (the design Stage-2
ambition) come after the process has survived once.

### 3.2 Data model (additive; futures sector 0.2.0)

All additions are new classes/properties in the `fut:` sector — a **new
immutable version IRI** (`…/sectors/futures/0.2.0`), additive/non-breaking,
dual-advertised per the sector contract (design/01, design/04 §2.1). Sketch:

```turtle
fut:InfraProposal a owl:Class ; rdfs:subClassOf wf:Task ;
    skos:definition "A proposed change to a shared digital system."@en .

# What system is being changed (≥1, SHACL MUST):
fut:targetsSystem a owl:ObjectProperty ; rdfs:domain fut:InfraProposal .
#   range: the governed artifact — an owl:Ontology version lineage, a protocol
#   profile document, a fedreg:Registry, or a shared-service descriptor IRI.

# The change kind (coded individuals, the fedreg:status pattern):
fut:proposalKind a owl:ObjectProperty .
#   fut:SpecChange / fut:NewSpec / fut:ServiceOperation / fut:Deprecation

# Blast radius, by stakeholder role (≥1, SHACL MUST):
fut:affectsRole a owl:ObjectProperty .
#   fut:ImplementerRole / fut:OperatorRole / fut:ParticipantRole

# Interop honesty (SHACL: breakingChange true ⇒ migrationPath present):
fut:breakingChange a owl:DatatypeProperty ; rdfs:range xsd:boolean .
fut:migrationPath  a owl:DatatypeProperty .   # plain-language migration story

# Running code (design/04 §2: REQUIRED before endorsement, not before compose):
fut:referenceImplementation a owl:ObjectProperty .  # repo/commit IRI

fut:AdoptionDecision a owl:Class ; rdfs:subClassOf fut:SharedFuture ;
    skos:definition "A converged recommendation to adopt a spec version;
    ratification is measured on the wire, never asserted."@en .
fut:proposesVersion  a owl:ObjectProperty .  # → the immutable owl:versionIRI
fut:adoptionBar      a owl:DatatypeProperty . # the measured criteria (default:
                                              # design/04 §2 — ≥2 impls + ≥2
                                              # communities advertising)
fut:adoptionEvidence a owl:ObjectProperty ;  rdfs:range fut:AdoptionObservation .

fut:AdoptionObservation a owl:Class ;
    skos:definition "One observed fedreg:acceptsSpec advertisement: who
    advertises which version, observed when, at which source IRI."@en .
#   properties: fut:observedParty, fut:observedVersion, fut:observedAt
#   (xsd:dateTime), fut:observationSource (the registry/storage-description IRI
#   the claim can be re-checked against — an index entry is a cache, never
#   authoritative; design/02 §2).
```

Notes:

- `fut:InfraProposal` keeps the inherited **`fut:motivatedBy` ≥1 need**
  requirement. Infrastructure proposals must stay value-centric too — "every
  pod server should speak the same live-notification channel" traces to real
  participant needs (reliability → *protection*; being able to build →
  *creation*). This is what stops scope B degenerating into a feature-request
  tracker.
- **Adoption status is computed, never asserted.** There is deliberately no
  `fut:adoptionStatus "Current"` decree property: an `fut:AdoptionDecision`
  carries its bar and its evidence, and any consumer recomputes
  *Current/Proposed/Superseded* from `fut:adoptionEvidence` against
  `fut:adoptionBar` — the same "index entries are re-checkable pointers"
  posture as design/02 §2, applied to governance. A captured room can sign a
  recommendation; it cannot sign adoption.
- **Stakeholder roles are declared-then-verified, fail-closed to
  `ParticipantRole`.** A participant may declare implementer/operator
  standing; the client verifies it against the public federation web (an
  implementer's implementation advertises the sector via
  `fedapp:`/`fedreg:acceptsSpec`; an operator's WebID is an `assertedBy`
  party on a live `fedreg:Registry`). Unverifiable claims degrade to
  participant, never error. This reuses `@jeswr/federation-client` /
  `@jeswr/federation-registry` reads; no new trust machinery.

### 3.3 Compose flow

A structured wizard (vs A's idea-first / C's narrative-first):

1. **Target** — pick the governed system (from the known spec lineages /
   registries; free IRI allowed, http(s)-validated like every IRI in
   `model.ts`).
2. **Change** — kind (coded), plain-language description (`as:content`,
   capped), breaking? → migration story required.
3. **Who is affected** — role checklist (drives the §3.4 role-cohort lens)
   + indirect stakeholders free text (the VSD prompt, design/03 §5 —
   Friedman & Hendry 2019).
4. **Needs trace** — attach/adopt ≥1 `fut:Need` (identical to today's
   machinery).
5. **Running code** — reference-implementation IRI; optional at compose,
   REQUIRED for endorsement (the SHACL profile enforces it on
   `fut:AdoptionDecision.prov:wasDerivedFrom` inputs, not on drafts).
6. Consent panel — unchanged (`fut:aggregate`/`synthesize` defaults;
   `governmentUse` largely irrelevant in B but harmless).

### 3.4 Views

| View | Shared skeleton | Scope-B delta |
|---|---|---|
| Overview | dashboard, roster, mode switch | + a **spec-lineage strip**: the governed systems, their current versions, live adoption counts |
| Compose | consent panel, needs machinery | the §3.3 structured wizard |
| Needs board | unchanged | cards can be `InfraProposal`s (kind/target/breaking badges) |
| Common ground | opinion map + bridging rank | + the **role-cohort lens** (below) |
| Convergence room | §2's shared room | endorsement candidate is an `AdoptionDecision`; the running-code check is a visible gate chip |
| **Adoption board** (NEW, B-only) | — | the ratification instrument: a versions × advertisers matrix per governed system, built from `fedreg:acceptsSpec` reads (each cell an `AdoptionObservation` with its re-checkable source); progress against the adoption bar; dual-advertisement (migration-window) visibility |
| Build channel (Phases 3–4) | shared with A | channels attach to reference-impl/migration trackers |

**The role-cohort lens.** The bridging math (`lib/ranking.ts`) is already a
pure function over *any* participant partition — `bridgingScore` takes a
`ClusterResult` and requires positive reception in every qualifying cluster.
Scope B runs it twice: once over computed opinion clusters (shared), once
over the **declared-role partition** (implementers / operators /
participants). The endorsement gate for an `AdoptionDecision` requires the
bridging threshold **in both partitions**: a change all users love but every
implementer dreads (or vice versa) must not clear. This is an *application*
of Ovadya's bridging objective to stakeholder strata rather than a mechanism
from the literature — flagged as such in §9; it needs expert review, but it
is cheap (no new math, one more `cluster()`-shaped input) and fail-safe (it
only ever *raises* the bar).

### 3.5 Convergence output + governance composition

- Endorsed output: `fut:AdoptionDecision`, Data-Integrity signed by ≥2
  stewards (floor per PLATFORM-PLAN §4.4), dissent annex mandatory as for
  every `fut:SharedFuture`.
- Endorsement gating composes Phase 2: proposing needs T1 (existing
  `minTierToPropose`); moving a candidate into the endorsement round needs a
  **reviewer** role credential; signing needs **stewards**. Spec-review is
  the reviewer role's scope-B meaning.
- Then design/04 §2 (4–5) runs *outside the room*: implementations adopt on
  their own clocks; the Adoption board watches; *Current* is recomputed —
  which is also the natural PROV-linked record for milestone **B4**.

---

## 4. Scope C — co-designing society

### 4.1 What the product IS

The **full expression-and-synthesis pipeline of design/01+03**, which the
current app implements only a slice of. Today the client has `fut:Need` +
`fut:Resonance`; design/01 specifies `fut:VisionStatement`, `fut:LifeContext`,
`fut:Claim` (with the adoption invariant), `fut:ValueStatement`,
`fut:SharedFuture`, `fut:DissentRecord`, `fut:ConvergenceMetrics`. Scope C
going live means implementing that layer — **not inventing a new one**:

> Scope C is where a person tells the whole story ("my current life, my ideal
> future"), the machinery decomposes it into voteable atoms, clusters map
> where the community actually stands, and the output handed onward is either
> a signed shared future that every cluster endorsed — with its dissent
> carried permanently — or an equally-published map of exactly where we
> divide. Nothing executes; institutions and humans decide (critique C8).

Its legitimacy grounding is already in design/03: Pol.is-style atomic-claim
mapping at national scale (Small et al. 2021; vTaiwan), mediated synthesis
that demonstrably incorporates minority views (Tessler et al., *Science* 386,
2024), deliberative-polling escalation for anything governance-bound
(Fishkin 2009), false-polarisation correction by always showing real
distributions (Ahler & Sood 2018), contact through shared needs (Allport
1954; Pettigrew & Tropp 2006), and the agonistic guardrails (Mouffe 2000).
One **new citation** for the product framing: the OECD's *Catching the
Deliberative Wave* (2020) documents the institutional demand side — hundreds
of citizens' assemblies commissioned by governments — which is the realistic
Stage-3 consumer for C's outputs: unite feeding *into* commissioned
deliberative processes (agenda-setting, option-space evidence), not
replacing them; consistent with critique C5's "self-selected maps inform;
mini-publics legitimate".

### 4.2 Data model

**Mostly zero new vocabulary** — implement the existing design/01 classes.
The only additions (also in the 0.2.0 sector version):

```turtle
# Convenience mirror so a SharedFuture is self-describing about legitimacy
# (design/03 §5: anything forwarded to governance carries which method
# produced it; today that requires walking prov to the Deliberation):
fut:methodProvenance a owl:ObjectProperty ; rdfs:domain fut:SharedFuture .
#   → the deliberation-method concept (resonance-mapping / mediated-synthesis /
#   mini-public). SHACL: REQUIRED on any SharedFuture whose inputs permitted
#   fut:governmentUse.

# The decomposition activity's seam-recording (design/03 §1), mirroring the
# SynthesisMediator PROV pattern for the compose-side assistant:
fut:decomposedBy a owl:ObjectProperty .  # → prov:Activity with prov:hadPlan
```

Everything else scope C needs is specified: the claim-adoption invariant
(`fut:adoptedBy`; nothing enters deliberation without the author's explicit
adoption — design/03 §1), sharing tiers incl. the pod-secret pseudonym
(design/01 access tiers; design/02 §5 T0), mandatory dissent
(SHACL-enforced), k-anonymous `ConvergenceMetrics` stratified by tier.

### 4.3 Compose flow — narrative first, decomposition second

The **inversion of A/B**: instead of composing an atom directly, the person
writes the whole story and the wizard derives atoms:

1. **Tell it** — free narrative (`fut:VisionStatement`, optionally
   `fut:LifeContext`), with `fut:scope` (self / household / community /
   nation / humanity) and optional `fut:horizon`. The whole-narrative form
   is psychologically load-bearing (design/03 §1) and also feeds the Futures
   gallery (§4.4).
2. **Split it** — decomposition into atomic `fut:Claim`s (≤500 chars,
   voteable), `fut:Need`s (Max-Neef-schemed), `fut:ValueStatement`s
   (Schwartz-schemed). **Manual-first** (recommended; §8 Q4): select-text →
   make-a-claim UI affordances; the author does the splitting. An assistant
   seam (`DecompositionAssistant`, mirroring design/05 §4's
   mediator-interface pattern: deterministic reference implementation +
   optional LLM + PROV `prov:hadPlan` recording via `fut:decomposedBy`)
   lands later; either way the adoption step below is what confers
   authorship.
3. **Adopt each** — per derived atom: adopt / edit / discard. Nothing is
   attributed without adoption (the C6 consent invariant).
4. **Choose voice** — primary WebID or pseudonymous WebID (T0; linkage
   secret never leaves the pod — design/01 tier 4). T0 composing is allowed
   (`minTierToPropose: 0` already in `scopes.ts`).
5. **Consent** — the existing ODRL panel, with `fut:governmentUse` given
   prominent, plain-language treatment (default OFF; design/01) and the
   "signed aggregates may persist after deletion" honesty line (critique C4).

### 4.4 Views

| View | Shared skeleton | Scope-C delta |
|---|---|---|
| Overview | dashboard, roster | + **tier-composition strip** (T0/T1/T2 counts — stratify-and-disclose, critique C3) |
| Compose | consent panel | the §4.3 narrative→decompose→adopt wizard |
| **Resonance deck** (NEW; primary reaction surface) | tallying, one-voice-per-person | card-at-a-time claims, tri-state + optional dimension, deterministic routing: prefer statements your cluster hasn't assessed that neighbouring clusters resonated with (design/03 §3's active-learning shape, implemented as a deterministic heuristic over the existing matrix — no novel ML); **no replies anywhere** |
| Needs board | unchanged | secondary/browse surface |
| Common ground | opinion map + rank + distributions | + per-tier stratified distributions on every ranked claim |
| **Futures gallery** (NEW, C-only) | — | whole vision narratives routed by the contact prior: from *outside your opinion neighbourhood*, *overlapping your need/value profile* (design/03 §2); bridging-ranked, never engagement-ranked; shows the shared needs first, the narrative second |
| Convergence room | §2's shared room | candidate `fut:SharedFuture`; critique round stratified across clusters; dissent annex assembly is the visually central element, not a footnote |
| **Published futures** (NEW, C-only) | — | signed `fut:SharedFuture`s + disagreement maps, rendered ONLY with dissent annex + bridging evidence + verified Data-Integrity proof (protocol profile item 8, design/02 §7) + the method-provenance label ("self-selected resonance map — informs; not a representative sample") |

### 4.5 Convergence output

- **`fut:SharedFuture` + mandatory dissent + `fut:ConvergenceMetrics`**,
  ≥2-steward signed, tier-stratified, method-provenance labelled. The
  disagreement map is the co-equal outcome and gets the same publication
  surface (design/03 §4 (5)).
- **No build layer, no commissions, no agents acting** (`buildLayer: false`
  stands). The only "execution" is publication + LDN announcement of the
  signed artifact to subscribing consumers.
- **Escalation** (later phase): sortition-based mini-publics for contested
  or governance-bound topics (design/03 §5) — a stratified random sample of
  the deliberation's participants as the endorsing body; the room machinery
  is identical, only the *endorser cohort* and the method-provenance label
  change.
- **Hard gate carried from critique C4:** scope C launches on
  low-sensitivity civic topics only; health/income-grade domains are blocked
  until privacy-preserving aggregation work exists. This is a launch
  constraint, not vocabulary.

---

## 5. What shares vs what is scope-specific

### 5.1 Shared (build once, all scopes consume)

| Machinery | Where it lives | Notes |
|---|---|---|
| Typed RDF round-trip, IRI/date guards | `lib/model.ts` | extend with the new classes, same guarded-accessor pattern |
| Pod I/O, container listing, scope guard | `lib/pod.ts` | unchanged |
| Aggregation (fail-isolated, creator-verified, deduped) | `lib/aggregate.ts` | generalise the statement kinds it collects; the gate/dedupe logic is scope-blind |
| Bridging math + clustering | `lib/ranking.ts` | already partition-agnostic — the role-cohort lens is a second input, not a fork |
| Opinion projection | `lib/projection.ts` | unchanged |
| Reception verdicts | `lib/insights.ts` | unchanged |
| ODRL consent | `lib/consent.ts` | unchanged |
| Membership/tier seam | `lib/membership.ts` + Phase-2 roles | consumed as interfaces everywhere |
| Registry, notifications | `lib/registry.ts`, `lib/notifications.ts` | unchanged |
| **Convergence Room** | new, built once in S1 (§6) | candidate → critique → endorse → dissent/disagreement-map; scope config selects the output pipeline |
| Overview / board / common-ground skeletons, routing, state | `ui/` | delta-rendered from ScopeConfig |
| Demo sandbox per scope | `demo/` | each scope keeps its own seeded deliberation |

### 5.2 Scope-specific (the honest deltas)

| Scope | Genuinely new modules |
|---|---|
| A | proposal board (task-model rendering); verify-against-needs prompt; commission pipeline (composes PLATFORM-PLAN Phases 3–4) |
| B | structured compose wizard; role declaration + verification (federation-client reads); role-cohort lens; **Adoption board** (`fedreg:acceptsSpec` matrix); `AdoptionDecision` output pipeline |
| C | narrative→decompose→adopt wizard (+ assistant seam); **Resonance deck** with routing; **Futures gallery** (contact-prior routing); tier-stratification surfaces; SharedFuture signing/publication pipeline; **Published futures** renderer |

### 5.3 The ScopeConfig extension (design sketch, not code)

Differentiation stays **configuration + a small set of pluggable pipelines**,
never view forks (the PLATFORM-PLAN §2 decision stands). Sketch:

```ts
interface ScopeConfig {
  // …existing fields (id, name, artifactNoun, hosts, buildLayer, status,
  //  minTierToPropose) unchanged…
  /** Which compose wizard Compose mounts. */
  readonly composeFlow: "need-first" | "structured-infra" | "narrative-decompose";
  /** Statement kinds the aggregator collects + the board renders. */
  readonly artifactKinds: readonly ArtifactKind[];
  /** Bridging partitions computed/required (opinion is always on). */
  readonly cohortLenses: readonly ("opinion" | "role" | "tier")[];
  /** Which output pipeline the Convergence Room hands an endorsed candidate to. */
  readonly outputKind: "build-commission" | "adoption-decision" | "advisory-synthesis";
  /** Extra views this scope enables (adoption-board, futures-gallery, deck, …). */
  readonly views: readonly ViewId[];
  /** Endorsement gate floors (composes Phase-2 roles; communities may raise). */
  readonly endorsementGate: {
    readonly crossCohort: readonly ("opinion" | "role")[];
    readonly reviewerRoleRequired: boolean;   // B: true
    readonly stewardSignatures: number;       // floor 2 (PLATFORM-PLAN §4.4)
  };
}
```

Resolution stays pure + fail-closed exactly as `resolveScope` is today; every
new field has a safe default (apps' values).

---

## 6. Build plan — preview → live, phased and gate-able

Every phase lands through the standing gates (lint / typecheck / vitest /
build, roborev, adversarial verify where security-relevant) and **extends the
conformance fixture set** (design/05 §6) with golden resources + scripted
flows for whatever it adds — that is what keeps B2 ("independent
implementation = passes the fixtures") true as the surface grows.

| Phase | Contents | Scope flips | Maps to PLATFORM-PLAN §7 | Depends on |
|---|---|---|---|---|
| **S0 — scope-config seams** (**SHIPPED**) | the §5.3 ScopeConfig extension + view scaffolding switches; pure, exhaustively unit-tested; zero behaviour change for `apps` | — | infrastructural (no §7 phase) | nothing |
| **S1 — the artifact + convergence spine** (**SHIPPED**) | A's proposal layer (`fut:AppProposal` compose + proposal board) + **Convergence Room v1** (candidate/critique/endorse/dissent/disagreement-map) end-to-end in demo mode; sector 0.2.0 draft authored (the §3.2 + §4.2 additions, one version bump — `vocab/futures-0.2.0-draft.ttl`); build decisions recorded in §6.1 | A completes its loop up to commissioning | **§7 Phase 8** (the §7 table's row; Phases 3/4/6 consume its output) | S0; Phase 2 for real endorsement identity (demo-gated before that) |
| **S2 — scope B live: propose + see adoption** | `fut:InfraProposal` model + structured compose + spec-lineage strip + **Adoption board** (read-only `fedreg:acceptsSpec` matrix via federation-client/registry); run the sector-0.2.0 change **as the first scope-B deliberation** (B4 executed for real) | **B → live** (propose/resonate/converge; ratification visible) | **= §7 Phase 5**, expanded | S1 |
| **S3 — scope B ratification machinery** | role declaration + fail-closed verification; role-cohort lens on Common ground; reviewer/steward endorsement gating; signed `fut:AdoptionDecision`; computed Current status | B fully live | composes **§7 Phase 2** (roles) | S2 + Phase 2 landed |
| **S4 — scope C live: voice** | expression layer (`VisionStatement`/`Claim`/`ValueStatement` + manual decompose + adopt); Resonance deck with deterministic routing; Futures gallery; T0 pseudonymous compose with tier badges | **C → live** (voice + mapping) | **= §7 Phase 7**, first half | S1 (parallel with S2/S3 — different modules) |
| **S5 — scope C outputs** | Convergence-room reuse for `SharedFuture` candidates; steward signing UI; mandatory-dissent SHACL enforcement in the client; `ConvergenceMetrics` publication (k-anonymous, tier-stratified); Published-futures renderer (proof-verified, dissent-required) | C fully live | **= §7 Phase 7**, second half | S4 + Phase 2 |
| **S6 — scope C legitimacy hardening** | mini-public escalation (sortition cohort + method-provenance label); perception-gap instrument (pre/post estimates); the C4 privacy gate formalised (sensitive-domain deliberations blocked pending privacy-preserving aggregation) | — | new — propose as **§7 Phase 9** | S5 |

Parallelism: after S1, the S2→S3 (B) and S4→S5 (C) tracks touch disjoint
modules and can run as concurrent work-fronts; S0/S1 are the shared spine
and must land first. The existing §7 Phases 1 (hosting), 2 (roles — in
flight), 3–4 (build channel), 6 (first live commission) are untouched by
this plan and interleave as their own dependencies allow.

### 6.1 Build decisions (S1) — recorded per the proceed-without-greenlight rule

Design calls made while landing S1, each reviewable and reversible:

1. **The critique unit got a class: `fut:Critique` (0.2.0 draft), wired ahead
   of the sector bump.** design/03 §4 captures critiques AS DATA and design/01
   assembles the `DissentRecord` FROM them, but no class named the unit. The
   draft mints it (`vocab/futures-0.2.0-draft.ttl` §4) and S1 uses it now —
   consistent with the §3.1 self-hosting plan, where the 0.2.0 ratification is
   itself the first scope-B deliberation. Same for `fut:indirectStakeholders`
   (the VSD compose prompt). Everything else in the draft (InfraProposal,
   AdoptionDecision, methodProvenance, decomposedBy) stays UNWIRED until
   S2/S4 (`app/src/lib/fut-draft.ts` records the wiring status).
2. **Endorsement votes are ordinary `fut:Resonance`s on the candidate; the
   outcome is COMPUTED, never asserted.** No `endorsed` status property
   exists: the room recomputes endorsed / disagreement / open live from the
   votes against the bridging threshold (`lib/convergence.ts`) — the same
   computed-not-asserted posture as scope B's measured adoption. A captured
   room could write a status triple; it cannot fake the distribution.
3. **Proposals and candidates are NOT in the opinion-space clustering
   universe.** Clusters come from NEED votes only, so drafting many
   candidates (or stuffing proposals) cannot reshape the cohorts that judge
   them; votes on a candidate are just its endorsement round. Revisit when
   proposals accumulate enough votes to carry real opinion signal.
4. **Proposal compose lives on the Proposals board, not the Compose wizard.**
   Compose keeps the need-first grammar (`composeFlow` unchanged — the
   §5.3 seam still selects it); the proposal form (title + idea + ≥1 needs
   trace + the VSD prompt) sits beside the board it lands on. Keeps A's
   compose surface byte-compatible and the satisfier/need split visible where
   proposals are read.
5. **`fut:AppProposal` asserts `wf:Task` explicitly** (both `rdf:type`s
   serialised) so plain `wf:Task` readers — solid-issues, Pod Manager —
   federate proposals without OWL subclass reasoning.
6. **Critique withdrawal = pod deletion.** A critic deletes the critique from
   their own pod (pod-sovereign); no tombstone machinery in v1. Standing
   critiques at endorsement time are the dissent-annex raw material (S5
   materialises the signed `DissentRecord` from them, honouring
   `quoteVerbatim`).
7. **Room quorum floors are v1 constants** (`ROOM_K = 2`,
   `ROOM_MIN_CLUSTER_SIZE = 2` in `lib/convergence.ts`) until the Phase-5
   community-registry wiring makes them community-configured (raise-only,
   per §4.4 of the platform plan).

---

## 7. Security & privacy posture (per-scope deltas only)

The platform-wide posture (PLATFORM-PLAN §8 — fail-closed verification,
guarded fetches, no credentials in URLs/logs, pure scope resolution) stands.
Scope-specific additions:

- **B:** the Adoption board fetches foreign registries/storage descriptions —
  every read through the guarded pod-scope discipline, observations stored
  with their source IRI so any consumer can re-check (no trusted cache);
  role verification is fail-closed to the weakest role; a reference-impl IRI
  is displayed as a link, never fetched/executed by the client.
- **C:** the intimacy-honeypot posture (critique C4) is UI-load-bearing:
  conservative ODRL defaults enforced at compose; pseudonym mode surfaced,
  not buried; the persist-after-deletion honesty line in the consent panel;
  aggregate-only publication of positions (your own map position visible
  only to you — design/05 §2); the sensitive-domain launch gate (§4.5);
  narrative text in the Futures gallery is shown only at the author's
  chosen sharing tier, and `fut:quoteVerbatim` remains a distinct opt-in
  because of stylometric re-identification risk.

---

## 8. Open questions for the maintainer (each with a recommended default)

Per the proceed-without-greenlight rule, building proceeds on the
recommendations; steer on unite#1 redirects the later phases.

1. **B's endorsement partition.** Should `fut:AdoptionDecision` endorsement
   require the bridging threshold across declared **stakeholder roles** in
   addition to computed opinion clusters (§3.4)? —
   **Recommend: yes, both partitions**, role-gate applied only at the
   endorsement step (the deliberation surface stays opinion-cluster-based
   and fully shared). It only raises the bar, reuses the existing math, and
   encodes "implementers can't be steamrolled and can't steamroll".
2. **B's initial governed surface.** unite's own spec lineage + the suite
   federation sectors first, or open to arbitrary external systems at
   launch? — **Recommend: self-host first** (§3.1): the first scope-B
   deliberation is the sector-0.2.0 change itself, which executes milestone
   B4 for real; external fediverse-style targets follow once the process has
   run end-to-end.
3. **C's compose assistant.** Ship LLM decomposition at S4, or manual-first
   with the `DecompositionAssistant` seam? — **Recommend: manual-first**
   (§4.3): the adopt/edit/discard step is the consent-critical piece and is
   identical either way; the LLM path adds PROV/model-attribution machinery
   best landed once the flow is proven (and keeps S4 free of any model
   dependency, per the C6/C7 anti-monoculture posture).
4. **C's bootstrap signing.** The 2-steward floor cannot be met while the
   maintainer is the only steward. Defer C outputs entirely, or publish with
   an explicit **"bootstrapping: single-steward"** label until a second
   steward exists? — **Recommend: the labelled path** — it keeps the full
   loop exercisable and is consistent with design/04 §6's honesty discipline
   ("describe governance as bootstrapping, never decentralised"); the floor
   snaps to 2 the moment a second steward is issued.
5. **C's seed topic.** Which deliberation seeds the society demo + first
   live round? — **Recommend: a concrete, low-sensitivity civic topic**
   (e.g. neighbourhood streets/transport — the vTaiwan-adjacent classic),
   never health/finance (the C4 gate), and something with real satisfier
   plurality so the needs-first mechanism has something to show.
6. **Naming.** Scope ids/nouns stand (`apps` / `infrastructure` / `society`;
   "infrastructure proposal" / "vision statement"). One open label: C's
   published artifact in UI copy — "shared future" (design term) vs
   "common-ground statement". — **Recommend: "shared future"**, matching the
   vocabulary and the platform's name story.

---

## 9. Honesty: what here is grounded vs speculative

**Grounded in the founding design's cited literature:** the shared substrate
(bridging: Ovadya 2022, Wojcik et al. 2022; opinion mapping: Small et al.
2021; needs-first convergence: Max-Neef 1991; values: Schwartz 1992;
synthesis loop: Tessler et al. 2024; distribution-always-visible: Ahler &
Sood 2018; contact routing: Allport 1954 / Pettigrew & Tropp 2006;
no-replies + no cluster-rooms: Sunstein 2002; dissent-as-data: Mouffe 2000;
mini-public escalation: Fishkin 2009; indirect stakeholders: Friedman &
Hendry 2019). B's adoption-ratification is design/04's own mechanism (IETF
rough consensus + running code; RFC 7282 added here as its concretisation);
Ostrom 1990 and OECD 2020 are **new supporting citations** introduced by
this doc for B's commons framing and C's institutional consumer story
respectively — both mainstream, neither load-bearing for any mechanism.

**Design extensions that are plausible but unvalidated (expert-review
items, extending the decisions/0001 EXPERT-REVIEW checklist):**

- **Role-cohort bridging** (§3.4) — applying the bridging objective to
  declared stakeholder strata is this design's own move, not a mechanism
  from the literature. Failure mode to watch: tiny role cohorts giving
  individuals veto power (mitigate with `minClusterSize` on the role
  partition, already a `bridgingScore` parameter).
- **Deterministic deck routing** (§4.4) — a simplification of Pol.is's
  active-learning comment routing; adequate for small deliberations,
  unproven at scale.
- **Contact-prior Futures gallery** (§4.4) — operationalises the contact
  hypothesis, but Mutz 2006's participation/exposure trade-off means its
  engagement cost is real and should be measured, not assumed away.
- **Adoption measurement** (§3.5) assumes a population of independent
  implementations advertising `fedreg:acceptsSpec` — which barely exists
  yet (the design/04 §6 bootstrap deficit). Until B2/B3, the Adoption board
  will honestly show a nearly-empty matrix; that emptiness is the correct
  display, not a bug to paper over.
- **C's decision-maker consumption** is aspirational until any institution
  engages; per critique C5 the product never claims representativeness, and
  every published artifact carries its method-provenance label.
