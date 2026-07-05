<!-- AUTHORED-BY Claude Fable 5 (PSS agent) — the persisted next-phases design (S4 landed). -->

# unite — next-phases design (S3, S5, agentic build layer, UI uplift)

**Status:** design record (Fable), authored 2026-07-05; persisted here as the durable design
home now that **S4 has landed to `main`** (merge `d2a65a8` — SOCIETY scope live). Authored
read-only against `jeswr/unite` @ `main` (`3e6cb03`) + the then-in-flight `feat/scope-s4-society`
(`860e49a`); the first landed piece of this plan is **S3.3 `app/src/lib/quorum.ts`** (the
multi-steward quorum keystone below). Extends — never redesigns — `docs/PLATFORM-PLAN.md`,
`docs/SCOPE-DIFFERENTIATION.md`, `design/01…06`, `decisions/0001`, and the landed
`app/src/lib/*`. Every "compose package X" claim below is grounded in that package's **actual
exported API** (read this session), and every vocab term is checked against the *published*
futures sector (`solid-federation-vocab/sectors/futures/futures.ttl` @ 0.2.0) — nothing is minted
that already exists, nothing is cited that doesn't. Speculative items are flagged inline.

---

## 0. The load-bearing invariants (all four designs preserve these; none may weaken them)

These are already enforced in code. Every phase below is written to **compose** them, never route
around them.

- **INV-1 — the synthesize-consent lineage gate (`app/src/lib/aggregate.ts:301-324`).** A
  Convergence-Room candidate (`SynthesisCandidate`) survives aggregation **only if every
  `prov:wasDerivedFrom` input is in `AggregateResult.synthesizable`** — i.e. the input's author's
  inline ODRL policy explicitly permits `fut:synthesize` (fail-closed: no policy / unparseable /
  prohibited ⇒ excluded, with a recorded `SourceError`). Enforced **aggregation-side**, not in any
  UI, so a candidate written straight to a pod cannot bypass it. **S3 and S5 both sign only
  candidates that come through this gate. No signing path may re-collect candidates by a route that
  skips it.**
- **INV-2 — dissent completeness (`fut:SharedFuture` SHACL, published vocab `futures.ttl` +
  design/01/03/06).** A `fut:SharedFuture` is **invalid** without either ≥1 `fut:dissent` (→
  `fut:DissentRecord`) **or** an explicit `fut:noDissentRecorded true`. Today S4 *renders* the
  annex; **S5 must make it un-signable to drop it** — the structural enforcement is the whole point
  of S5.
- **INV-3 — computed, never asserted.** Adoption status is recomputed from `fut:AdoptionObservation`
  evidence against `fut:adoptionBar` (`adoption.ts:210 computeAdoption`); Room endorsement outcome is
  recomputed from the bridging distribution (`convergence.ts:70 candidateReception`). There is
  deliberately **no `fut:adoptionStatus "Current"` decree property and no `endorsed` status
  property**. "A captured room can sign a recommendation; it cannot sign adoption." S3's signed
  `AdoptionDecision` signs the *recommendation + its bar + its evidence pointer*, never a status.
- **INV-4 — fail-closed + SSRF-guarded + credential-free foreign reads.** Every cross-origin read
  goes through the guarded pod-scope discipline (`pod.ts isWithinBase/assertWithinBase`,
  `adoption.ts` https-only + byte-cap + per-source isolation, credential-free `publicFetch`).
  Credentials never in URLs/logs; reference-impl IRIs displayed as links, never fetched. Signing keys
  are steward-held; the browser only *verifies*.
- **INV-5 — no single owner.** ≥2 steward signatures is a **floor** (PLATFORM-PLAN §4.4; communities
  may raise, never lower); a steward-circle recommendation needs ≥3 unaffiliated orgs (design/04 §3);
  adoption is ratified on the wire, not in the room (design/04 §2). The bootstrap reality (one
  steward today) is handled by an **explicit "bootstrapping: single-steward" label**, never by
  lowering the floor silently.
- **INV-6 — one-person-one-voice + creator binding (`aggregate.ts:186, dedupeResonances`).** A
  statement counts only if `dct:creator` matches the registry's WebID for that pod; one resonance per
  (creator, statement), latest wins. Any new cohort/partition (S3 role lens) reuses this verified
  participant set — never a fresh, ungated one.

---

## 1. S3 — the infrastructure GOVERNANCE tier (scope B ratification machinery)

### 1.1 What S3 is (and what S2 already left in place)

S2 shipped scope B to `status: "live"`: a person can compose a `fut:InfraProposal` (structured
wizard, `ComposeInfra.tsx`), the community resonates + converges in the shared Room, and the
**Adoption board** (`adoption.ts` + `AdoptionBoard.tsx`) *observes* adoption by reading
`fedreg:acceptsSpec` off live `fedreg:StorageDescription` docs and **computing** Current / Superseded
/ Proposed. What S2 deliberately deferred (its own build-decision §6.2.7): **verified role standing,
the role-cohort endorsement lens, reviewer/steward endorsement gating, and the SIGNED
`fut:AdoptionDecision`.** S3 is exactly those four, and only those four. It is the transition from
*"observed adoption"* (a read instrument) to *"decided adoption"* (a signed, cross-stakeholder-gated
recommendation whose ratification is still measured on the wire).

The governing rule is design/04 §2, already decided and unchanged: a version becomes **Current** only
on **≥2 independent implementations interoperating + ≥2 independent communities advertising via
`fedreg:acceptsSpec`** — "measured on the wire, not declared." S3 does **not** change that. S3 adds
the *deliberative front-end's decision artifact*: a signed recommendation that carries its bar and
its re-checkable evidence, so a consumer recomputes Current itself (INV-3).

### 1.2 Data model — everything needed already exists in the published 0.2.0 sector

Verified present in `solid-federation-vocab/sectors/futures/futures.ttl` @ `owl:versionInfo 0.2.0`
(and mirrored in `app/src/lib/fut-draft.ts`, currently UNWIRED for signing):

| Term | Kind | Role in S3 |
|---|---|---|
| `fut:AdoptionDecision` ⊑ `fut:SharedFuture` | class | the S3 output artifact (inherits mandatory dissent + bridging evidence + Data-Integrity signing from `fut:SharedFuture`) |
| `fut:proposesVersion` | obj prop | → the immutable `owl:versionIRI` being recommended |
| `fut:adoptionBar` | datatype prop | the measured criteria the decision names (default: design/04 §2) |
| `fut:adoptionEvidence` | obj prop → `fut:AdoptionObservation` | the re-checkable evidence set |
| `fut:AdoptionObservation` + `fut:observedParty`/`observedVersion`/`observedAt`/`observationSource` | class + props | one `fedreg:acceptsSpec` reading (already produced by `adoption.ts observeAdoption`) |
| `fut:affectsRole` ∈ `fut:ImplementerRole`/`OperatorRole`/`ParticipantRole` | prop + coded individuals | the declared blast-radius roles (already on `InfraProposal`) — the role-cohort partition's basis |
| `fut:bridgingEvidence` → `fut:BridgingEvidence` (+ counts) | inherited | per-cohort endorsement evidence, incl. the **role partition** |
| `fut:dissent` / `fut:noDissentRecorded` | inherited | the mandatory annex (INV-2) |
| `fut:SharedFutureCredential` | class | the VC wrapper (design/01 prose; data-model only — see §1.4 gap) |

**Mint nothing.** The one thing the vocab does *not* give is a class for a **verified role
declaration**. Do **not** mint one: a role is already a signed `fedtrust:MembershipCredential`
scoped to `<community>/roles/<role>` (`trust.ts roleScopeIri`), and *stakeholder-role* standing
(implementer/operator/participant on a proposal's `fut:affectsRole` partition) is **declared-then-
verified against the public federation web**, degrading fail-closed to `ParticipantRole` — a
computed fact, not a stored triple. Keep it computed (INV-3 posture): a declared role that can't be
verified is simply not counted, never persisted as an authority claim.

### 1.3 The four S3 mechanisms, each composing shipped code

**(a) Role declaration + fail-closed verification.** SCOPE-DIFFERENTIATION §3.2: a participant may
*declare* implementer/operator standing; the client *verifies* it against the public federation web —
an implementer's implementation advertises the sector via `fedreg:acceptsSpec` /
`fedapp:`; an operator's WebID is an `assertedBy` party on a live `fedreg:Registry`. Compose:
`@jeswr/federation-registry` `parseStorage` (already used by `adoption.ts`) + `parseRegistry` /
`verifyMembership` (well-formedness + `assertedBy`, signature-free — the reviewed caveat) to resolve
the declared role, fail-closed to `ParticipantRole`. This is a **new pure module** `lib/roles.ts`
(declared role → verified `StakeholderRole`), mirroring `adoption.ts`'s fail-isolated, https-only,
credential-free discipline (INV-4). No new trust machinery.

**(b) The role-cohort bridging lens.** The bridging math (`ranking.ts bridgingScore`) is already a
pure function over *any* participant partition + a `minClusterSize` floor. S3 runs it **twice**: over
computed opinion clusters (`cluster()` — shipped) AND over the **verified-role partition** from (a).
The `EndorsementGate.crossCohort` config already declares `["opinion", "role"]` for infrastructure
(`scopes.ts:189`). New code = a thin adapter that builds a `ClusterResult`-shaped partition from the
verified roles and feeds it to the existing `bridgingScore` — *no new math* (SCOPE-DIFFERENTIATION
§3.4 confirms this is an application, not a new mechanism). **Honesty flag (design's own, unchanged):
role-cohort bridging is unvalidated in the literature; failure mode is tiny role cohorts giving veto
— mitigate with `minClusterSize` on the role partition (already a `bridgingScore` parameter). It only
ever *raises* the bar, so it is fail-safe.** Surface it in the Common-ground view's `role` lens
(today an honest "arrives in S3" banner, `Bridging.tsx:130-144`).

**(c) Reviewer/steward endorsement gating.** Composes the **already-shipped** `trust.ts`: moving a
candidate into the endorsement round needs a **reviewer** role credential (`hasRole(profile,
"reviewer")`); the `EndorsementGate.reviewerRoleRequired: true` is already set for infrastructure.
This is a UI gate over `useTrustProfile` — a locked state (mirroring the existing `Compose` tier
gate) when the session lacks the reviewer role. No new verification code; `CredentialTrustResolver`
already resolves roles fail-closed.

**(d) The signed `fut:AdoptionDecision` + computed Current.** On a Room candidate that (INV-1) came
through the synthesize gate, (b) cleared the bridging threshold in **both** partitions, and (INV-2)
carries a complete dissent annex, a **builder-or-steward** assembles a `fut:AdoptionDecision` graph:
`fut:proposesVersion` the immutable version IRI, `fut:adoptionBar` the design/04 §2 criteria,
`fut:adoptionEvidence` the current `AdoptionObservation` set from `adoption.ts observeAdoption`, plus
the inherited `prov:wasDerivedFrom` lineage + `fut:bridgingEvidence` + dissent annex. It is then
**signed by ≥2 stewards** (§1.4). The Adoption board **recomputes** Current/Proposed/Superseded from
`fut:adoptionEvidence` vs `fut:adoptionBar` live (INV-3) — the signature attests the recommendation,
never the status.

### 1.4 The one genuinely new primitive: multi-steward (quorum) signing — and why it must be built

**This is the load-bearing gap for both S3 and S5, verified against the actual package APIs.** The
≥2-steward floor (INV-5) needs *N distinct WebIDs* to each sign *the same artifact*. The shipped
crypto does **not** give this out of the box:

- `@jeswr/solid-vc` `countersign` produces a **proof set**, but `verifyCredential`'s issuer-binding
  gate requires **every** proof's `verificationMethod` to be controlled by the **single** `vc.issuer`
  (`solid-vc/src/verify.ts:388`). So *distinct* stewards counter-signing one credential does **not**
  verify — that path is for one issuer's multiple keys.
- `@jeswr/federation-trust` `verifyMembershipCredential` is intrinsically **single-issuer / single-
  signature** (reads `vc.proof[0]`, one trusted anchor key). No M-of-N notion anywhere.
- Ordered proof *chains* ("advisor B endorses A's signature") are **explicitly not implemented**
  (`solid-vc/src/countersign.ts:18-38`).

**The correct, mint-nothing composition: N independent VCs over a shared content digest, plus a
unite-local quorum verifier.** solid-vc **does** ship the primitives for this:
`digestRdfContent(content, contentType?)` / `digestQuads` → a canonical `digestMultibase` (RDFC-1.0),
the `relatedResource` binding, and `verifyRelatedResources` / `presentedResources` on the verify
side. So:

1. Canonically hash the `fut:AdoptionDecision` graph → a `digestMultibase` (RDFC-1.0, the same
   canonicalisation `solid-a2a` and `agent-authz-verifier` already rely on).
2. **Each steward** issues an *independent* `solid-vc` credential (`issue()`) whose
   `credentialSubject` is the AdoptionDecision IRI, binding that digest via `relatedResource`
   (`digestMultibase`), `proofPurpose: assertionMethod`, issuer = the steward's WebID, verified
   against the community's trust anchors. This is exactly the shape `fut:SharedFutureCredential`
   already describes in design/01 (a VC over the artifact) — **no new vocab class**, and each
   signature retains its per-signer WebID identity binding (unlike a countersign proof set).
3. A **new unite-local quorum verifier** (`lib/quorum.ts`): given the artifact + a set of presented
   steward VCs, verify each with `solid-vc verifyCredential` (which already gates signature,
   issuer-binding, validity window, related-resource digest, **and** `credentialStatus` revocation
   via the shipped Bitstring Status List seam — see below), confirm each binds the *same* digest,
   count **distinct** valid steward issuers, and return `met = distinctStewards >= floor`. Pure,
   fail-closed, exhaustively testable.

This composes only shipped APIs (`solid-vc issue`/`verifyCredential`/`digestRdfContent`/
`relatedResource`, `trust.ts` role resolution to identify who is a steward). **It mints no vocabulary
and adds no crypto** — it aggregates existing single-signer verifications into a quorum count. It is
the one net-new *reusable* piece; I recommend building it as a small unite module first and flagging
it in `UPSTREAM-CHANGES`-style notes as a candidate to later extract as `@jeswr/quorum-attestation`
(the suite has no quorum primitive; `accountable-agent-runtime` lists the same lack as gap G15
"countersigning"). **Do not** approximate quorum with a multi-controller `isControlledBy` — that
discards per-signer identity binding (the audit says so explicitly) and would weaken INV-5.

**Revocation (immediate, not just expiry).** `solid-vc` ships a full W3C Bitstring Status List v1.0
(`buildBitstringStatusListCredential`, `createBitstringStatusResolver`, wired via
`VerifyCredentialOptions.resolveStatus`, fail-closed to `unreachable`). `trust.ts` today relies on
90-day expiry only and never plumbs `resolveStatus`. **S3's quorum verifier SHOULD pass
`resolveStatus` so a revoked steward signature drops immediately** — this closes the "abuse of
revocation is itself a capture vector" concern (design/04) without new crypto. (Plumbing
`resolveStatus` through `federation-trust`'s membership verifier for *role* revocation is a separate,
larger change — flag as a follow-up, not an S3 blocker; S3's own signing path calls solid-vc
directly and can use it now.)

### 1.5 S3 build plan (bead-sized; ⚙ = new pure module, 🎨 = view)

1. **S3.1 ⚙ `lib/roles.ts` — declared→verified stakeholder role.** Pure; input a declared role +
   the federation web reads (`parseStorage`/`parseRegistry`), output a verified `StakeholderRole`
   fail-closed to `ParticipantRole`. Mirror `adoption.ts` isolation/https/byte-cap. Exhaustive unit
   tests incl. hostile-doc + degrade cases. *Independent of S4.*
2. **S3.2 ⚙ role-cohort lens.** Adapter: verified-role partition → `ClusterResult` shape →
   `bridgingScore` (reuse). Extend `convergence.ts` so an infrastructure candidate's endorsement is
   computed over **both** partitions; the gate is met only when both clear. Add `minClusterSize`
   guard on the role partition. Unit-test the "loved-by-users, dreaded-by-implementers must not
   clear" case. *Depends on S3.1.*
3. **S3.3 ⚙ `lib/quorum.ts` — the multi-steward attestation verifier** (§1.4). `digestRdfContent`
   the artifact; verify N independent steward VCs (each binds the digest, `resolveStatus` plumbed);
   count distinct valid stewards vs floor. Fail-closed, pure, exhaustive tests (forged digest, wrong
   issuer, revoked, expired, one-steward-signs-twice → counts once, below-floor). *Independent — this
   is the S3/S5 shared keystone; build it first.*
4. **S3.4 ⚙ `lib/adoption-decision.ts` — build + sign + verify `fut:AdoptionDecision`.** `n3.Writer`
   build (never hand-concat) from a gated candidate + current `AdoptionObservation` set; the
   ≥2-steward quorum sign via S3.3; verify path recomputes Current from evidence (reuse
   `computeAdoption`). Enforce INV-1 (only a gated candidate) + INV-2 (dissent annex present) + INV-3
   (no status triple) at build time — throw on violation, mirroring `model-society.buildClaimQuads`'s
   adoption-invariant throw. *Depends on S3.3.*
5. **S3.5 🎨 reviewer/steward gating + role-declaration UI + AdoptionDecision surface in the Room.**
   Reviewer-role locked state on the endorsement action; a role-declaration control (calls S3.1); the
   Room's adoption-decision output stage renders the signed decision + the live Current recompute +
   the ≥2-steward progress (honest "1 of 2" until a second steward exists). *Depends on S3.1-4 +
   the UI component system (§4).*
6. **S3.6 🎨 role-cohort lens in Common ground + Adoption board wiring.** Turn the "arrives in S3"
   banner into the real role-partition distributions; link an AdoptionDecision to its live evidence
   column on the Adoption board. *Depends on S3.2, S3.5.*

**S3 sequencing: entirely independent of S4/S5.** Its dependencies (S2 scope-B, Phase-2 role
credentials) are both **shipped on main**. S3 can start immediately, in parallel with the S4 rebase,
touching disjoint modules (`lib/roles.ts`, `lib/quorum.ts`, `lib/adoption-decision.ts`,
`convergence.ts` role extension, scope-B views). S3.3 (quorum) is the shared keystone S5 also needs —
**build it first.**

---

## 2. S5 — the society signing/publication tier with STRUCTURALLY ENFORCED mandatory dissent

### 2.1 What S5 is

S4 (the rebase in flight) lands scope C's **voice** layer: `fut:VisionStatement`/`Claim`/
`ValueStatement`, manual narrative→decompose→adopt compose, the Resonance deck, the Futures gallery,
T0 pseudonymous compose, and the Room reused for `fut:SharedFuture` candidates with the dissent annex
**rendered** (`SharedFutureOutcome.tsx` presents it, incl. "0 of ≥2 steward signatures" honestly
unmet). S5 makes the output **real and verifiable**: a `fut:SharedFuture` is actually **signed** and
**published**, and — the maintainer's precise ask — the mandatory dissent is **structurally enforced
at signing**: a synthesis that drops registered dissent must be **un-signable / invalid**, not merely
displayed.

### 2.2 The dissent-completeness invariant, made structural (the heart of S5)

Today INV-2 lives in the SHACL profile and is *rendered*. S5 must make it **unrepresentable to
publish without it**, exactly as `model-society.buildClaimQuads` already makes an unadopted claim
unwritable (`adoptedBy !== creator` throws). Concretely, a new `lib/shared-future.ts`
`buildSharedFutureQuads(sf)` / `signSharedFuture(...)` that **throws before serialisation** unless:

- **(D1) dissent completeness (INV-2):** ≥1 `fut:dissent` → a `fut:DissentRecord` **or** an explicit
  `fut:noDissentRecorded true`. Silence is never consensus. This is the un-signable rule.
- **(D2) dissent *faithfulness* (the maintainer's "drops registered dissent"):** the annex must
  account for the **standing critiques at endorsement time**. Compose `convergence.ts
  standingCritiques(candidate)` — the same function the Room already uses — to enumerate the live
  critiques on the candidate; `signSharedFuture` refuses if a standing critique is neither
  materialised into a `fut:DissentRecord` nor explicitly dispositioned. This is the structural teeth:
  you cannot sign a synthesis that silently omits a critique that was standing when it converged.
  **This does not weaken INV-1:** a critique published *verbatim* in the annex requires its author's
  `fut:quoteVerbatim` consent (compose `consent.ts parseConsent`); a critic who withholds
  quoteVerbatim is represented in aggregate (cluster/cohort position) but not quoted — the annex
  carries the dissent either way, never erases it.
- **(D3) bridging evidence present (INV-3):** ≥1 `fut:bridgingEvidence` (the per-cluster counts the
  Room already computes) — the proof it is common ground, recomputable by any consumer.
- **(D4) method-provenance label:** `fut:methodProvenance` set (resonance-mapping / mediated-
  synthesis / mini-public) — SHACL-required when any input permitted `fut:governmentUse`; always
  carried in UI copy ("self-selected resonance map — informs; not a representative sample").

### 2.3 Data model — again, everything exists

Verified in the published sector: `fut:SharedFuture` (+ `fut:dissent`, `fut:noDissentRecorded`,
`fut:bridgingEvidence`, `fut:endorsedBy`, `fut:methodProvenance`), `fut:DissentRecord`,
`fut:ConvergenceMetrics` (+ `clusterCount`, `crossClusterConsensusRate`, `participantCount`,
`verificationTier`, `bridgingScore`), `fut:SharedFutureCredential` (the VC wrapper, design/01 prose /
data-model only). **Mint nothing.** The `fut:DissentRecord` is materialised from the same `Critique`
records `convergence.ts` already reads.

### 2.4 Composition — the same quorum signer as S3, plus dissent + metrics + renderer

- **Signing.** Reuse **S3.3 `lib/quorum.ts`** unchanged: N independent steward `solid-vc` VCs over
  the RDFC-1.0 digest of the `fut:SharedFuture` graph = the `fut:SharedFutureCredential`. Same ≥2
  floor (INV-5), same single-steward "bootstrapping" label (design/04 §6 / SCOPE-DIFFERENTIATION §8
  Q4 recommended default), same `resolveStatus` revocation. This is why S3.3 is the shared keystone.
- **Verification / publication.** The **Published-futures** view (today a PreviewView placeholder,
  the *only* genuinely unbuilt surface — `registry.tsx`) renders a signed `fut:SharedFuture` **only**
  when: the quorum verifier confirms the steward signatures over the artifact digest (Data-Integrity
  proof verified — protocol-profile MUST item 8, design/02 §7), the dissent annex is present (D1/D2),
  the bridging evidence is present (D3), and the method-provenance label is shown (D4). A disagreement
  map (a failed candidate) is a **co-equal** published outcome with the same surface.
- **ConvergenceMetrics.** Publish `fut:ConvergenceMetrics` **k-anonymous, tier-stratified** (design/02
  §5 "stratify and disclose"). **k-anonymity gap to close (INV-1-adjacent):** `consent.ts` *parses*
  `fut:kThreshold` (default 5) but nothing *enforces* it on publication today. S5's metrics publisher
  must enforce it — a per-cluster/per-tier count below `k` is suppressed/coarsened, never published
  raw. This is a new enforcement point, composing the already-parsed threshold; it must not be
  skippable (fail-closed: unknown k ⇒ the conservative default 5).
- **No build layer, no agents (INV, `buildLayer: false` stands).** The only "execution" is
  publication + an **LDN `as:Announce`** of the signed artifact to subscribing consumers. Compose
  `@jeswr/solid-chat-interop` only for the announcement message shape if desired; the transport is a
  pod inbox POST (no new server surface).

### 2.5 An S5 invariant checkpoint on the aggregate gate (must verify against the S4 rebase)

INV-1's `synthesizable` set is populated in `aggregate.ts` for `need`/`app-proposal`/`infra-proposal`
via the inline-ODRL `fut:synthesize` hook. **S5 must confirm the S4 branch's aggregate-society
additions feed the society expression kinds (`vision`/`claim`/`value`) into `synthesizable` through
the *same* hook** — otherwise either the gate wrongly excludes every society candidate, or (worse) a
society-specific bypass was added that weakens INV-1. Read the S4 `aggregate-society` changes when the
rebase lands; **the correct state is: society expression statements carry inline ODRL consent exactly
like needs, and their `synthesize` permission is what admits a society candidate's lineage.** Do not
add a society-scope shortcut around the gate.

### 2.6 S5 build plan

1. **S5.0 (prereq) — S3.3 `lib/quorum.ts` exists** (built in the S3 track; shared).
2. **S5.1 ⚙ `lib/dissent.ts` — materialise `fut:DissentRecord` from standing critiques**, honouring
   per-critique `fut:quoteVerbatim` consent (verbatim vs aggregate-only), producing the annex quads
   via `n3.Writer`. Pure, tested (a withheld-quoteVerbatim critique appears in aggregate, never
   quoted). *Depends on S4 (society Room + critiques).*
3. **S5.2 ⚙ `lib/shared-future.ts` — build + sign + verify with the D1-D4 structural guards.**
   `buildSharedFutureQuads` throws on missing dissent annex / unaccounted standing critique / missing
   bridging evidence / missing method-provenance (§2.2), mirroring the claim-adoption throw pattern;
   `signSharedFuture` = the quorum sign; `verifySharedFuture` = quorum verify + annex/proof checks.
   Exhaustive tests: **the un-signable cases are the core test surface** (drop a dissent → throws;
   omit a standing critique → throws; `noDissentRecorded true` with a standing critique present →
   throws). *Depends on S5.1 + S3.3.*
4. **S5.3 ⚙ `lib/convergence-metrics.ts` — k-anonymous, tier-stratified publication**, enforcing
   `fut:kThreshold` (suppress/coarsen sub-k cells; fail-closed default 5). *Depends on S4 tier data.*
5. **S5.4 🎨 steward signing UI** in the Room's advisory-synthesis output stage: the ≥2 progress, the
   single-steward bootstrapping label, the sign action gated on the steward role
   (`hasRole(profile,"steward")`). *Depends on S5.2 + UI component system.*
6. **S5.5 🎨 Published-futures renderer** (replaces the last PreviewView): proof-verified, dissent-
   required, bridging-evidence-shown, method-provenance-labelled; disagreement maps co-equal; LDN
   `as:Announce` on publish. *Depends on S5.2-4.*

**S5 sequencing: depends on S4 landing** (society voice + the society Room + critiques + tier data
are its inputs). Its one cross-track dependency is **S3.3 `lib/quorum.ts`** — build that in the S3
track and S5 reuses it verbatim. S5.1/S5.3 can be scaffolded against the S4 branch's interfaces before
the rebase merges, but should not merge to main until S4 does.

---

## 3. The agentic "Slack-style build layer" (scopes A + B; `buildLayer: false` for C stands)

### 3.1 What it concretely IS for unite

A **pod-native collaboration + build workspace** where a converged, endorsed proposal (scope A: an
app spec synthesis; scope B: a signed `fut:AdoptionDecision` + reference impl) becomes actual built
software **with agents as first-class, labelled, accountable participants** — and where the whole
chain from "the community decided this" to "this code merged" is a **walkable, signed audit trail**.
The differentiator over Devin/Codex/Copilot/Factory (PLATFORM-PLAN §5.1, primary-source-surveyed) is
the one thing none of them has: **verifiable cross-organisation accountability** — *who authorised
this agent, under what policy, traceable by an outside auditor*. That is "the accountable-web-of-
agents stack with a chat UI." It is scope A + B only; scope C never builds (INV: `buildLayer: false`).

The grammar (adopted from the survey): **a channel/thread per unit of work; agents are addressable
participants; commissioning is conversational; the agent reports in-thread; the deliverable is a
reviewable diff; humans hold merge authority** — with a signature wherever the others have a mere
workspace setting.

### 3.2 Data model — no new vocabulary

| Concept | Term / shape | Package |
|---|---|---|
| a channel (one per commissioned synthesis) | `wf:Tracker` | `@jeswr/solid-task-model` |
| a thread (feature / review round) | `wf:Task` | `@jeswr/solid-task-model` |
| a message (in the author's own pod, LDN-announced) | `CanonicalMessage` (`as:inReplyTo` threading, `MessageProvenance` PROV-O AI-attribution, `MessageTask` open/closed overlay) | `@jeswr/solid-chat-interop` |
| an agent participant | `AgentDescriptor` → A2A Agent Card + ANP RDF + WebID owner back-link | `@jeswr/solid-agent-card` |
| the NL ask → typed task | `Intent` (`parseIntent`, injected LLM seam) + SHACL shape + upgrade handshake | `@jeswr/solid-a2a` |
| what the agent may do (the commission policy) | `odrl:Agreement` chained via `odrld:delegatedUnder`, `evaluateDelegated` | `@jeswr/solid-odrl` |
| the signed per-artifact commission / delegation chain | `fedtrust:DelegationCredential` (`issueDelegation` → `DelegationLink[]`) + `solid-vc` | `@jeswr/federation-trust` (+ `@jeswr/solid-vc`) |
| chain verification (the audit expander) | `verifyAgentAuthority` (4-phase, fail-closed) | `@jeswr/agent-authz-verifier` |
| per-action provenance + the auditor walk | `actionProvenance` PROV bundle; `writeActivity`/`auditArtifact` (zero-credential re-verify) | `@jeswr/solid-odrl` + `accountable-agent-runtime` |
| durable per-agent working memory across sessions | `mem:MemoryItem` | `@jeswr/solid-memory` |
| egress safety in the aggregator | guarded fetch (INV-4) | `@jeswr/guarded-fetch` |

### 3.3 What is real today vs what unite must build (grounded, honest)

**The accountability SPINE is real and composable today** (all verified this session, pure/injectable/
golden-mastered): `discoverAgent` (owner back-link, fail-closed) → `parseIntent` (NL→RDF, injected
LLM seam, no network in the package) → `evaluateDelegated` (ODRL chain, root-first, per-request
intersection, depth-bounded) → `issueDelegation` + `solid-vc issue` (signed per-artifact commission)
→ `verifyAgentAuthority` (4-phase: assembly → A per-hop verify + policy digest → B subject-issuer
binding → C Bitstring status ∪ policy revocation → D delegated eval, + the D9 identity-composition
rule) → `actionProvenance` PROV bundle → `auditArtifact` (a **zero-credential auditor that re-runs the
4-phase verify at the action instant and flags divergence/breach**). `accountable-agent-runtime` is
**Phase-2 shipped** — it runs this live over CSS with an LDN carrier and real DPoP sessions.

**What is genuinely MISSING for "Slack" (the collaboration/runtime layer — do not overclaim these
exist):**

1. **No reusable live transport / channel carrier.** `solid-a2a` "builds no networking"; the only
   working carrier is the **demo-scoped** LDN inbox layer *inside* `accountable-agent-runtime`
   (`src/live/ldn.ts`, hardcoded to the demo cast; BUILD-PLAN gap G11 — the roadmap's
   `@jeswr/solid-agent` runtime carrier **does not exist yet**).
2. **No cross-pod channel/feed aggregator.** "each participant's messages live in their own pod,
   announced to the channel inbox, aggregated by the client" has **no package** — `chat-interop`
   reconciles a single message; nothing collects a tracker's tasks + every participant's pod messages
   into one ordered feed. **This is unite's to build** — and it is *the same shape as
   `aggregate.ts`*: fail-isolated, creator-verified, deduped, guarded reads over participant pods.
3. **No commission/task lifecycle beyond binary open/closed.** `MessageTask.state` is only
   `open|closed`. The `drafted → commissioned → in-progress → PR-open → in-review → merged/rejected`
   machine, the progress-report model, and the **draft-commission → signed-delegation** binding are
   unbuilt.
4. **No human-approval / merge-gate primitive** (`verifyAgentAuthority` verifies *delegation*, not
   "hold pending N signed human approvals"); no **merge-event object** linking reviewer approvals +
   the chain (design/04 §4.3 describes it; unbuilt). Related unbuilt: G15 countersigning (the same
   quorum gap as §1.4 — S3.3 `lib/quorum.ts` is directly reusable here for the ≥2-reviewer-approval
   gate), G3 challenge-domain replay defence.
5. **No agent execution runtime** — nothing here writes code / opens a PR; the actual doer is
   external and explicitly deferred (PLATFORM-PLAN §5.4 phase 4 / §9 Q3: "which agent runtime, where
   it runs" is a `needs:user` wiring decision — the @jeswr agent suite itself is the natural first
   commissionee).

### 3.4 Invariants the build layer preserves

- **Structural commissioning (PLATFORM-PLAN §5.2 / §4.3):** `@agent build <synthesis-IRI>` **drafts**
  a commission; it is real only when a **builder-credentialed human signs** a `fedtrust:
  DelegationCredential` naming *that exact synthesis IRI* as scope. **No blanket "build whatever"
  delegations** — per-artifact only. This composes S3.3's quorum machinery for the ≥2-reviewer-
  approval merge gate.
- **Agents never post as humans** (`chat-interop MessageProvenance` PROV-O attribution is mandatory
  on agent messages; `solid-agent-card` owner back-link labels every agent).
- **Merge authority is human + signed** (design/04 §4.3: ≥2 reviewer approvals, ≥1 distinct from the
  builder's voucher set — the quorum verifier enforces distinctness; security surfaces add a steward-
  acknowledged review).
- **Fail-closed audit (INV-4):** the "why was this merged?" expander is `auditArtifact` — a zero-
  credential re-verification, not a trusted cache.

### 3.5 Build plan (PLATFORM-PLAN §5.4, made bead-sized)

1. **BL.1 ⚙ `lib/channel.ts` — the cross-pod channel aggregator** (the missing piece): a
   `wf:Tracker` + its `wf:Task`s + every participant's pod `CanonicalMessage`s → one ordered,
   creator-verified, guarded, deduped feed. **Reuse `aggregate.ts`'s exact discipline** (this is its
   sibling). *Independent; buildable now.*
2. **BL.2 🎨 read-only channel view** (scope A/B, `scope.buildLayer`): render the feed + agent-
   attribution labels (`discoverAgent`), threads, PROV-bundle links. No new server surface. *Depends
   on BL.1 + UI component system.*
3. **BL.3 ⚙ commission lifecycle + drafting.** The state machine (`drafted → commissioned → …`), the
   draft-commission object, and posting participant messages to own pod + LDN announce. *Depends on
   BL.1.*
4. **BL.4 ⚙ signed commissions + the merge gate + audit-walk expander.** `issueDelegation` naming the
   synthesis IRI; the ≥2-reviewer-approval gate via **S3.3 `lib/quorum.ts`**; the "why merged?"
   expander via `verifyAgentAuthority` / `auditArtifact` (client-side verify). *Depends on BL.3 +
   S3.3.*
5. **BL.5 — a live commissioned agent** (the @jeswr suite takes a real commission end-to-end;
   Stage-1 exit-criterion material). **`needs:user`: which agent runtime, where it runs, whose keys**
   (PLATFORM-PLAN §9 Q3). The reusable transport (`@jeswr/solid-agent`) does not exist yet — its
   extraction from `accountable-agent-runtime`'s LDN layer (gap G11) is a prerequisite and a
   suite-level bead, not a unite-local one.

**Build-layer sequencing:** BL.1-BL.4 are **client-side and independent of S3/S4/S5** (different
files: `lib/channel.ts` + `build/` views), and reuse S3.3. BL.4 shares the quorum keystone with S3.
BL.5 is genuinely blocked on maintainer wiring + a suite-level transport-extraction bead — mark it
`needs:user`, do not stall the rest on it.

---

## 4. UI-QUALITY plan

### 4.1 The honest audit (correcting the premise)

The maintainer's read — *"the UI is quite crap and it looks like none of the features are really
built in"* — is **half right, and the wrong half is load-bearing.** Ground truth (full view-by-view
audit this session):

- **The features ARE built and wired.** On `main` + the S4 branch, **every** base view and every
  scope-A/B view is fully wired to the real `lib/` pipeline and exercises it end-to-end (demo mode
  runs the *actual* aggregation/ranking/convergence code over an in-memory LDP pod, not a mock).
  Every "differentiator" module (`ranking`, `projection`, `insights`, `convergence`, `adoption`,
  `trust`) is surfaced. The **only** genuinely unbuilt surface is `published-futures` (S5).
- **Why it *looks* unbuilt — two real causes:**
  1. **On `main`, the whole `society` scope is placeholders** (`deck`/`futures-gallery`/`published-
     futures` render `PreviewView`; Compose shows an "arrives in S4" note; **no Room**). If the
     maintainer viewed `?scope=society` on main, that scope legitimately looks empty. It only becomes
     real on `feat/scope-s4-society`. **→ landing the S4 rebase is the single biggest "nothing is
     built" fix.**
  2. **Presentation quality lags the substance.** One hand-rolled 1,265-line stylesheet; a real token
     layer + complete dark mode + solid a11y scaffolding (good foundations), but a **utilitarian,
     form-dense, debug-console aesthetic**, copy-pasted card/empty/panel markup across ~8 views (no
     shared `Card`/`EmptyState`), the two "hero" analytical screens under-designed (the Common-ground
     **opinion map** is a bare 2-gridline SVG; the Adoption **"matrix"** is a *row of cards*, not a
     matrix/table), long single-page compose forms, and **no mobile reflow** (overflow-scroll
     everywhere). `@jeswr/app-shell` + `solid-elements` are used for **chrome only** (theme toggle,
     feedback button, login panel); all view UI is bespoke.

So the uplift is a **reskin + information-architecture + component-system pass over working features**,
plus landing S4 — **not** "build the features." Frame it that way to avoid wasted rebuild.

### 4.2 Design direction (apply real sensibility — this is the flagship)

The token layer already encodes a coherent intent: *"calm, paper-and-ink, legible, quietly
distinctive"* — petrol primary, gold for common-ground/bridging, a colour-blind-checked stance triad,
humanist display type. **Keep that vocabulary; raise the execution.** Concretely:

- **A shared component system** (the highest-leverage move): extract `Card`, `EmptyState`,
  `StatBar`/`KPI`, `Badge`, `Panel`, `SectionHeader`, `LockedGate`, `DistributionBar`,
  `StepWizard` (generalise the S4 4-step `NarrativeCompose` — the best-structured flow in the app —
  into the pattern all compose forms use). This kills the copy-paste, makes every view consistent,
  and is the render foundation S3/S5/BL views need. Keep the app-shell OKLCH tokens as the source of
  truth; consider whether `@jeswr/solid-elements` P0 chrome components can replace bespoke chrome
  (out-of-scope for a first pass — do not block the uplift on it).
- **The two hero screens** get real design investment (they carry the intellectual claim):
  - **Common ground / opinion map** — the SVG scatter is the product's thesis made visible (bridging,
    not engagement). Give it real design: cluster hulls/shading, labelled axes with a plain-language
    legend, larger tactile distribution bars, hover/selection, the "received best in every cluster"
    cards as a first-class panel. Score to 2 sig-figs, not 3 decimals (analytical → inviting).
  - **Adoption board** — render the versions × advertisers structure as an **actual matrix/table**
    (the copy promises it; today it's a card row). Cells = re-checkable observations; the computed
    Current/Proposed/Superseded status as a clear column state; the honest near-empty matrix (design
    §9: emptiness is correct, not a bug) presented as a *designed* empty, not a gap.
- **Reduce debug-console density** on Trust / Room / Overview: progressive disclosure (the raw
  participant textarea, skipped-source error lists, and IRI-heavy metadata behind `<details>`);
  fewer walls of explanatory prose per state (move the "how it works" copy into a designed onboarding
  panel, not inline in every view).
- **Mobile reflow**: the dense forms and the two-column bridge grid need real breakpoints, not
  overflow-scroll. This is table-stakes for "genuinely good."
- **Keep the honesty discipline** (it is a strength, not clutter): the `demo deliberation` badge, the
  `PreviewView` "not built yet — and not faked" placeholders, the "0 of 2 stewards" honest-unmet
  states. A good UI makes these *legible*, not hidden.

### 4.3 UI build plan (prioritised)

1. **UI.1 🎨 the shared component system** — extract `Card`/`EmptyState`/`Badge`/`Panel`/`StatBar`/
   `LockedGate`/`StepWizard` from the existing markup; migrate the 8 views onto them (behaviour-
   preserving; the tests already exist). **This is the P0 keystone.** *Independent of everything.*
2. **UI.2 🎨 hero screen: Common-ground opinion map** redesign (cluster hulls, axes/legend, bigger
   distribution bars, selection). *Depends on UI.1.*
3. **UI.3 🎨 hero screen: Adoption board as a real matrix/table** + designed empty state. *Depends on
   UI.1; complements S3.6.*
4. **UI.4 🎨 compose-form uplift** — generalise the S4 `StepWizard` pattern; apply to
   `ComposeInfra` (currently one long page) and `Compose`. *Depends on UI.1; coordinate with the S4
   rebase (don't churn `NarrativeCompose` mid-rebase).*
5. **UI.5 🎨 density + progressive disclosure** on Overview/Trust/Room; onboarding panel. *Depends on
   UI.1.*
6. **UI.6 🎨 mobile reflow** across dense forms + the bridge grid. *Depends on UI.1.*
7. **UI.7 🎨 honest scope-status landing** — the A-live / B-live / C-preview ladder rendered
   truthfully on main (until S4 lands, society *is* preview on main — say so, don't fake it).
   *Independent.*

**UI sequencing:** UI.1 is independent and unblocks everything (S3/S5/BL views all render through
it). UI.2/UI.3 are independent hero-screen work. UI.4 must **coordinate with the S4 rebase** (avoid
editing `NarrativeCompose`/`Compose` while the rebase touches them — do UI.4 after S4 merges, or on
the shared component only). UI.7 is independent and cheap.

### 4.4 One coordination hazard (repeats the brief's own warning)

The S4 rebase is in flight and touches `Compose.tsx`, `Room.tsx`, `scopes.ts`, `aggregate.ts`,
`registry.tsx`, and adds society views. **Do not** start UI.4/UI.5 on those exact files, or any S5
work, until S4 merges — they will conflict. UI.1 (new component files), UI.2/UI.3 (bridge + adoption
views, untouched by S4), UI.7, and the **entire S3 track + BL.1** are on disjoint files and safe to
run in parallel with the rebase.

---

## 5. Sequencing summary + the single highest-value next build

### 5.1 Dependency graph

```
SHIPPED on main: S0, S1, S2 (scope B live, read-only adoption board), Phase-2 role credentials.
IN FLIGHT:       S4 (society voice) — rebase.

Independent of the S4 rebase (start now, disjoint files):
  UI.1 (component system) ─┬─▶ UI.2, UI.3, UI.6   (hero screens + mobile)
                           └─▶ (render foundation for S3/S5/BL views)
  UI.7 (honest landing)
  S3.1 (roles) ─▶ S3.2 (role lens) ─▶ S3.6
  S3.3 (quorum) ──▶ S3.4 (AdoptionDecision) ─▶ S3.5   [S3.3 is the SHARED keystone]
  BL.1 (channel aggregator) ─▶ BL.2 ─▶ BL.3 ─▶ BL.4 (reuses S3.3)

Blocked on S4 merging (share files the S4 rebase touched — Room/Compose):
  S5.1 (dissent materialiser) ─▶ S5.2 (un-signable guard, reuses S3.3) ─▶ S5.4, S5.5
  S5.3 (k-anon metrics)
  UI.4 (compose-form uplift — file conflict with S4)
  UI.5 (density + progressive disclosure — touches Room.tsx; see §4.4)

needs:user (human wiring, not opinion):
  BL.5 (which agent runtime / keys)  ·  a second steward (snaps the ≥2 floor)  ·
  the @jeswr/solid-agent transport extraction (suite-level bead, gap G11)
```

Two keystones do double duty: **`lib/quorum.ts` (S3.3)** is reused by S3, S5, and BL.4; **the UI
component system (UI.1)** is the render foundation for every new view. Build both early.

### 5.2 The single highest-value next build

**The UI-quality P0 — `lib/`-agnostic component system (UI.1) + the two hero screens (UI.2 Common-
ground map, UI.3 Adoption matrix) + the honest scope-status landing (UI.7).** Rationale:

1. It is **exactly the maintainer's complaint** ("quite crap / looks like nothing's built") — and the
   audit proves the fix is *presentation*, not features, so the payoff-to-effort is high.
2. It is **fully independent of the S4 rebase** (new component files + the bridge/adoption views S4
   doesn't touch + the landing) — zero conflict, can start immediately.
3. It **makes the already-built features finally read as a real product** — the biggest perceived-vs-
   actual gap in the whole initiative.
4. It is the **render foundation** S3, S5, and the build layer all need — doing it first prevents
   re-skinning those views later.

The **highest-value new *feature* build** (parallel, different files, also unblocked) is the **S3
track led by `lib/quorum.ts` (S3.3)** — it completes scope B's governance, is fully unblocked (S2 +
Phase-2 shipped), and produces the multi-steward quorum keystone that S5 and the build-layer merge
gate both reuse. Run UI.1 and S3.3 concurrently as the two opening moves; land the S4 rebase to
unblock the S5 track and to make society real on main.

### 5.3 Honest flags (do not overclaim)

- **Speculative / expert-review (design's own, unchanged):** role-cohort bridging (S3.2), deterministic
  deck routing + contact-prior gallery (S4), the near-empty adoption matrix until B2/B3 (correct
  display, not a bug).
- **Genuinely new code (not a package capability):** `lib/quorum.ts` (no suite quorum primitive
  exists — this is a *composition* of shipped solid-vc `issue`/`verifyCredential`/`digestRdfContent`/
  `relatedResource`/status-list, not new crypto; candidate to upstream as `@jeswr/quorum-attestation`);
  `lib/channel.ts` (no cross-pod channel aggregator exists — a sibling of `aggregate.ts`).
- **Missing package capabilities the build layer needs** (verified): reusable live transport
  (`@jeswr/solid-agent` unbuilt), real-time fan-out for a channel UI, task/commission lifecycle,
  human-approval/merge gate, agent execution runtime. BL.1-BL.4 build the client-side pieces over the
  *shipped* accountability spine; BL.5 is `needs:user`.
- **Revocation:** solid-vc's Bitstring Status List is shipped and should be plumbed via `resolveStatus`
  in `lib/quorum.ts`; plumbing it through `federation-trust` for *role* revocation is a larger
  follow-up, not an S3/S5 blocker.
