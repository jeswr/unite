<!-- AUTHORED-BY Claude Fable 5 (PSS design agent) -->

# 05 — Stage-1 MVP: the app-co-design instance

Stage 1 uses unite to **co-design the Solid apps people want**: Solid apps
are primarily front-ends over pod data, so once a community converges on a
spec, **GenAI implements it** — and the implementation engine already exists:
the @jeswr agent suite, with its gating discipline (roborev, adversarial
verify, conformance harness). Stage 1 is deliberately self-hosting: unite's
first community co-designs unite's own ecosystem, which both proves the
mechanism and keeps the stakes appropriate while it matures (app specs, not
public policy).

## 1. The end-to-end loop (what a user can actually do)

```
IDEA ─▶ NEEDS ─▶ RESONANCE ─▶ CONVERGE ─▶ IMPLEMENT ─▶ SHIP ─▶ VERIFY-AGAINST-NEEDS
 │        │          │            │            │          │            │
 propose  articulate Pol.is-style GenAI/human  agent      app in the   contributors check
 an app   values +   deck on      synthesis +  suite      registry +   acceptance criteria
 idea     needs it   needs/claims critique +   builds     app store    against their OWN
 (a wf:   serves     (bridging-   endorsement  from the                original needs;
 Task)    (fut:      ranked)      (dissent     SpecSyn-                unmet → new
          motivatedBy)            carried)     thesis                  deliberation round
```

1. **Propose.** Anyone creates a `fut:AppProposal` (= `wf:Task` +
   `fut:motivatedBy`) in their own pod, announced to the co-design
   community. Because proposals *are* shared-model tasks, they federate into
   solid-issues and Pod Manager unchanged — the proposal board is a
   solid-issues tracker.
2. **Articulate.** The proposer (and anyone resonating) attaches
   `fut:Need`s / `fut:ValueStatement`s: *what in your life does this serve?*
   A proposal with no adopted needs never advances (SHACL). The VSD template
   (03 §5) asks for **indirect stakeholders** explicitly.
3. **Resonate.** The community works a bridging-ranked resonance deck over
   the proposal's needs and claims; the opinion map shows where the
   community genuinely agrees ("offline-first matters more than sync speed")
   vs. divides ("calendar-first vs list-first").
4. **Converge.** The §4 synthesis loop (03) produces a `fut:SpecSynthesis`:
   concrete screens/flows/data-model, every `fut:acceptanceCriterion` linked
   to the need it operationalises, rejected alternatives named, dissent annex
   carried ("three contributors want E2E encryption in v1; deferred because…").
5. **Implement.** The endorsed SpecSynthesis opens a `wf:Tracker`
   (`fut:implementationTracker`); the agent suite builds the app under its
   normal gates (worktree agents, roborev, adversarial verify, the new-repo
   checklist — nothing about the GenAI step bypasses engineering discipline;
   critique C7). The tracker is public: contributors watch their spec being
   built and file deviations as issues.
6. **Ship + verify.** The app registers in the federation
   (`fedapp:` self-description; `fedreg:Membership` in the community
   registry; listed in solid-app-store). Then the loop **closes**:
   contributors are prompted to check each acceptance criterion against
   their *own original need* — need-satisfaction results (resonance records
   on the criteria) publish as open metrics, and unmet needs seed the next
   deliberation round. This last step is what makes it participatory design
   rather than a suggestion box.

## 2. Screens (the seed client)

| Screen | What it shows | Mechanism it embodies |
|---|---|---|
| **Horizon** (home) | bridging-ranked feed of whole vision narratives + active proposals from across your communities; always shows the *actual* resonance distribution on anything ranked | 03 §0 bridging; §2 contact + perception-gap correction |
| **Compose** | wizard: free-text vision/life/idea → GenAI-drafted claim/need decomposition → **adopt/edit/discard each** → sharing tier + ODRL consent panel (plain-language: "may be aggregated ✓ / quoted ✗ / used in gov reporting ✗") | 03 §1 elicitation; 01 consent layer |
| **Resonance deck** | card-at-a-time claims/needs: resonates / conflicts / unsure (+ optional dimension); routed by the active-learning + bridging prior; shows the map updating | 03 §3 Pol.is layer |
| **Opinion map** | the deliberation's cluster visualisation; group-informed consensus statements pinned; your position shown *privately to you only* | 03 §3; aggregate-only publishing |
| **Convergence room** | synthesis candidate + critique thread (the only threaded surface) + endorsement vote + live bridging-threshold status + the dissent annex being assembled | 03 §4 Habermas-Machine loop |
| **Proposal board** | the co-design community's tracker: proposals as kanban cards (solid-issues rendering), each showing its needs-trace and deliberation state | Stage-1 loop; task-model federation |
| **My pod** | every statement/resonance you've made, its tier + policies, adoption history, revoke/delete; pseudonym manager (T0 identities) | G2 sovereignty; 02 §5 tiers |

## 3. Packages composed (all existing suite pieces)

| Concern | Package |
|---|---|
| Scaffold + chrome | `create-solid-app`, `@jeswr/app-shell` (+ `@jeswr/solid-elements` where framework-agnostic) |
| Auth + session | `@solid/reactive-authentication`, `@jeswr/solid-session-restore`, `@jeswr/solid-dpop` |
| RDF read/write | `@jeswr/fetch-rdf` (parse), `@solid/object` / `@rdfjs/wrapper` (typed accessors), `n3.Writer` / `@jeswr/rdf-serialize` (serialise) — never hand-built triples |
| Proposals/trackers | `@jeswr/solid-task-model` (AppProposal = wf:Task; implementationTracker) |
| Federation | `@jeswr/federation-client` (fedapp self-description), `@jeswr/federation-registry` (community registries), `@jeswr/federation-trust` (signed memberships, vouching VCs) |
| Consent | `@jeswr/solid-odrl` (author + evaluate use-policies) |
| Integrity | `@jeswr/solid-vc` (signed SharedFutures; personhood-credential seam) |
| Live updates | `solid-notifications` skill patterns (WebSocketChannel2023); `solid-agent-notify` for agent-side announces |
| Egress safety | `@jeswr/guarded-fetch` (every cross-origin fetch in indexer/facilitation services) |
| Declarative views | `@jeswr/solid-components` (SHACL-driven rendering of fut: shapes — the codegen framework rendering the co-designed specs is pleasingly recursive) |

**New build surface** (the actual Stage-1 engineering): the `fut:` sector
(PR into solid-federation-vocab), a `@jeswr/unite-model` typed accessor
package (the solid-task-model pattern: vocabulary + typed read/write + SHACL,
nothing app-specific), the facilitation service (indexer + ODRL gate +
opinion-space mapping + synthesis mediation seams), and the seed client.
The convergence math (PCA/k-means, bridging scores) is small, well-specified,
and testable against published Pol.is behaviour — fixture-driven, no novel ML.

## 4. Facilitation-service seams (so no vendor locks in)

The mediator and the mapper are **interfaces**, not implementations:
`OpinionMapper` (resonance matrix → clusters + consensus) and
`SynthesisMediator` (consenting inputs + critiques → candidate text). Both
ship with: a deterministic reference implementation (auditable, no LLM), an
LLM-backed implementation (model configurable per community, PROV-recorded),
and a **human-mediated** implementation (a facilitator UI). Conformance
requires a community be able to run entirely without any specific model
vendor (02 §6, critique C7).

## 5. Stage-1 exit criteria (before any Stage-2 claim)

1. Governance milestones **B1–B4** met (04 §6) — including the second
   independent implementation (B2).
2. ≥ 3 apps co-designed, implemented, shipped, and **needs-verified** through
   the full loop, with published ConvergenceMetrics.
3. ≥ 2 independent communities completing deliberations, at least one using a
   non-LLM or human mediator end-to-end.
4. A published post-mortem per app: where the synthesis misrepresented the
   deliberation, where GenAI implementation deviated from the spec, and
   perception-gap/consensus metrics — the empirical record Stage 2 legitimacy
   arguments will rest on.

## 6. Conformance fixtures

The Stage-1 deliverable includes an executable fixture set (the suite's
interop-fixture discipline): golden `fut:` resources (valid + invalid per
SHACL), a scripted deliberation (N synthetic participants, resonance matrix →
expected clusters + expected group-informed-consensus set → expected bridging
threshold outcome), ODRL evaluation cases (k-threshold, quote-prohibition,
revocation timing), and announce/index/notification protocol flows. B2's
"second implementation" means *passing these*, so "independent implementation"
is a measurable claim.
