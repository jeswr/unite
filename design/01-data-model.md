<!-- AUTHORED-BY Claude Fable 5 (PSS design agent) -->

# 01 — Data model: the `fut:` (futures) sector vocabulary

**Namespace (seed):** `https://w3id.org/jeswr/sectors/futures#`, prefix
`fut:`. Authored in the suite's established fed-vocab **sector pattern**
([solid-federation-vocab](https://github.com/jeswr/solid-federation-vocab)):
the sector imports the gUFO-based `core:` ontology, roots every class in a
core class with a gUFO meta-type, **constrains but never forks** the
vocabularies it reuses, ships a SHACL closed-world profile alongside the
open-world OWL, and carries `owl:versionInfo` + an immutable
`owl:versionIRI`.

> **Namespace governance note.** Seeding under `w3id.org/jeswr` mirrors how
> every other sector bootstrapped, but a vocabulary for a no-single-owner
> platform cannot *stay* under one person's namespace. [04-governance.md]
> (04-governance.md) specifies the migration path to a steward-circle-governed
> namespace (`w3id.org/unite`), and the `fedreg:acceptsSpec` dual-advertisement
> substrate is exactly the machinery that makes a namespace/spec-version
> migration survivable mid-flight.

## Reused vocabularies (mint nothing that exists)

| Vocabulary | Used for |
|---|---|
| **AS2** (`as:`) | content model of statements (`as:content`, `as:mediaType`), announcement (`as:Announce`), reactions alignment (`as:Like`), collections |
| **SKOS** (`skos:`) | the **need scheme** and **value scheme** concept hierarchies; per-community extensions via `skos:ConceptScheme` + mapping properties (`skos:exactMatch`/`closeMatch`) |
| **PROV-O** (`prov:`) | derivation of claims from visions, syntheses from claims; attribution of GenAI vs human activity (`prov:wasGeneratedBy`, `prov:wasDerivedFrom`, `prov:Plan` for model+prompt) |
| **ODRL 2.2** (`odrl:`) | per-statement **use-consent policies** (what aggregation/quotation/reporting uses the author permits) |
| **DCT** (`dct:`) | titles, descriptions, timestamps, creators |
| **wf:/tm:** ([solid-task-model](https://github.com/jeswr/solid-task-model)) | Stage-1 app proposals are `wf:Task`s so the existing task federation reads them |
| **VC 2.0 / Data Integrity** (via [@jeswr/solid-vc](https://github.com/jeswr/solid-vc)) | signed syntheses; optional personhood/eligibility credentials |

## Class inventory

### Expression layer (lives in the author's pod)

- **`fut:LifeContext`** — "my current life": a self-description of present
  circumstances. gUFO: SubKind of `core:InformationResource` (it *describes*
  a situation; the situation itself is not reified in v0.1). Content via
  `as:content`; may carry `fut:expressesNeed` links.
- **`fut:VisionStatement`** — "my ideal future": a narrative description of
  the best possible future *for the author* (and, the author may say, for
  whom else). SubKind of `core:InformationResource`. Properties: `dct:title`,
  `as:content`, `dct:created`, `dct:creator` (WebID or pseudonymous WebID),
  `fut:horizon` (an optional target timeframe, `xsd:gYear` or a SKOS period),
  `fut:scope` (self / household / community / nation / humanity — SKOS
  concepts; the scope ladder matters for convergence, see 03 §2).
- **`fut:Claim`** — an **atomic, voteable statement** derived from a vision or
  authored directly: one idea, short, standalone — the Pol.is unit of
  deliberation. `prov:wasDerivedFrom` its source `fut:VisionStatement`;
  `fut:articulates` (Vision → Claim, inverse-functional composition edge).
  When GenAI performs the decomposition (03 §1), the activity is recorded
  (`prov:wasGeneratedBy` with the model+prompt as `prov:Plan`) **and the
  author must approve each derived claim before it becomes theirs** —
  approval is `fut:adoptedBy` + the claim moving into the author's pod.
  Nothing enters deliberation attributed to a person without that person's
  explicit adoption.
- **`fut:Need`** — a need or want *felt by the author*: `fut:needConcept` →
  a concept in a need scheme (below); `as:content` free-text; `fut:intensity`
  (optional 1–5); `fut:metBy`/`fut:unmetBecause` free-text context.
- **`fut:Satisfier`** — a *way of meeting* needs: a proposal, practice,
  institution, technology, or app. `fut:satisfies` → `fut:Need` (an instance)
  and/or the need *concept*. **This split is load-bearing** — see "The
  needs/satisfiers split" below.
- **`fut:ValueStatement`** — an expression that the author holds a value:
  `fut:valueConcept` → a concept in a value scheme; `as:content`;
  `schema:position` for the author's own priority ordering.

### Reaction layer (lives in the *reactor's* pod)

- **`fut:Resonance`** — the vote/endorsement primitive. Aligns to `as:Like`
  but is richer and tri-state, following Pol.is's agree/disagree/pass:
  - `fut:onStatement` → the Claim/Need/Satisfier/ValueStatement reacted to
  - `fut:stance` ∈ **`fut:Resonates` / `fut:Conflicts` / `fut:Unsure`**
    (coded individuals, the pattern `fedreg:status` uses)
  - `fut:dimension` (optional) ∈ `fut:IShareThis` / `fut:IAspireToThis` /
    `fut:IWouldSupportThis` — sharing a *present* condition, an *aspiration*,
    and a willingness to *support others having it* are psychologically
    distinct and the convergence math wants them separable
  - `dct:created`, author. Stored in the reactor's pod; announced to the
    deliberation inbox. Resonances are the raw material of opinion-space
    mapping (03 §3) and are only ever published in aggregate (see ODRL layer).

### Process layer (lives in the community's space)

- **`fut:Deliberation`** — a scoped convergence exercise: a `prov:Activity`
  (and `as:Event`) with `dct:title`, a topic, a time window, the method used
  (`fut:method` → SKOS: resonance-mapping / mediated-synthesis / mini-public),
  and the participating community. All statements and resonances entering a
  deliberation reference it via `fut:inDeliberation`.
- **`fut:SharedFuture`** — the **convergence artifact**: a synthesized
  shared-future statement. Properties:
  - `as:content` — the synthesis text
  - `prov:wasDerivedFrom` → every input statement (traceable, subject to each
    input's ODRL policy)
  - `prov:wasGeneratedBy` → the synthesis activity, with `prov:wasAssociatedWith`
    the mediator (human WebID or GenAI agent id) and `prov:hadPlan` (model,
    prompt/version) — GenAI mediation is never invisible
  - `fut:bridgingEvidence` → per-cluster endorsement statistics (03 §4): for
    each opinion cluster, resonates/conflicts/unsure counts — the *evidence*
    that this is common ground, not one cluster's position
  - `fut:endorsedBy` → post-synthesis `fut:Resonance` records
  - **`fut:dissent` → `fut:DissentRecord` (MANDATORY, may be empty only with
    an explicit `fut:noDissentRecorded true` assertion)** — see below
  - signed as a VC (`fut:SharedFutureCredential`) by the facilitating
    community with a Data Integrity proof, so downstream consumers (Stage 3:
    governments) can verify integrity + provenance without trusting the wire.
- **`fut:DissentRecord`** — a first-class minority report attached to a
  synthesis: `as:content`, the dissenting cluster/cohort (in aggregate),
  optionally authored dissent statements whose authors opted in. **A
  SharedFuture without its dissent annex is invalid** (SHACL-enforced).
  Rationale: 03 §6 and critique C1/C8 — convergence must never mean erasure.
- **`fut:ConvergenceMetrics`** — the published aggregate for a deliberation:
  cluster count, cross-cluster consensus rate, bridging-score distribution,
  participation counts by verification tier (see 02 §5). Open data, k-anonymous.

### Stage-1 layer (app co-design; see [05-stage1-mvp.md](05-stage1-mvp.md))

- **`fut:AppProposal`** ⊑ `wf:Task` — a proposed Solid app. Because it *is* a
  task in the [solid-task-model](https://github.com/jeswr/solid-task-model)
  shared model, it federates into solid-issues and Pod Manager for free
  (kanban, assignment, state). Adds: `fut:motivatedBy` → `fut:Need` /
  `fut:ValueStatement` — **every proposal must trace to at least one need**,
  which is what keeps Stage 1 value-centric rather than feature-listing.
- **`fut:SpecSynthesis`** ⊑ `fut:SharedFuture` — the converged app spec handed
  to GenAI implementation: adds `fut:acceptanceCriterion` (each criterion
  linked back to the `fut:Need` it operationalises — the closing-the-loop
  check in 05 §4) and `fut:implementationTracker` → `wf:Tracker`.

## The needs/satisfiers split (the data model's convergence thesis)

Max-Neef's Human Scale Development (see [03-convergence.md](03-convergence.md)
§2 for the citation and discussion) distinguishes **fundamental human needs**
— few, universal, and stable across cultures (subsistence, protection,
affection, understanding, participation, idleness/leisure, creation, identity,
freedom) — from **satisfiers**, the culturally-variable ways needs are met.
People who violently disagree about satisfiers ("cars vs trains") routinely
share the underlying needs ("get to work reliably; breathe clean air").

The data model bakes this in: `fut:Need` instances point at concepts in a
**need scheme** (`fut:maxneefScheme`, a `skos:ConceptScheme` seeded from
Max-Neef's nine, extensible per community via `skos:narrower` and cross-mapped
via `skos:closeMatch`), while `fut:Satisfier` is a *separate class* linked by
`fut:satisfies`. Convergence machinery (03) computes common ground **at the
needs layer first**, where it structurally exists, and treats satisfier
diversity as a feature to preserve, not noise to average away. The value
scheme (`fut:valueScheme`) is likewise seeded from Schwartz's basic-values
circumplex (03 §2), giving the clustering a psychologically meaningful prior
rather than an ad-hoc tag soup.

**Neither scheme is closed or centrally owned**: any community can publish its
own `skos:ConceptScheme` and map it. The seed schemes are defaults, not law —
a deliberate G1 (no-single-owner) decision that costs some comparability
(critique C9 discusses the trade).

## The ODRL consent layer (what leaving your pod means)

Every expression-layer resource MAY carry `odrl:hasPolicy` → an ODRL 2.2
policy over these actions (profiled in a small `fut:` ODRL profile):

| Action (profile term) | Meaning |
|---|---|
| `fut:aggregate` | may be included in opinion-space mapping + metrics (k-anonymous aggregate only) |
| `fut:synthesize` | may be an input to a `fut:SharedFuture` (implies being listed in `prov:wasDerivedFrom` — pseudonymously if the author is pseudonymous) |
| `fut:quoteVerbatim` | may be quoted verbatim in a synthesis/dissent |
| `fut:governmentUse` | derived artifacts may be forwarded into Stage-3 governance reporting |
| `odrl:derive` constraint `fut:kThreshold` | any derived publication must aggregate ≥ k contributors (default k=5) |

Defaults are **conservative**: `aggregate` + `synthesize` permitted,
`quoteVerbatim` and `governmentUse` prohibited until explicitly granted.
Policies are the author's standing consent record; a community's facilitation
services MUST evaluate them before use (client-side evaluation via
[@jeswr/solid-odrl](https://github.com/jeswr/solid-odrl)), and every
`fut:SharedFuture` carries the evaluated-policy audit trail in its provenance.
Revocation: deleting or re-policying the pod resource revokes *future* use;
already-signed syntheses record what was consented *at synthesis time*
(critique C4 examines the residual).

## Access control and privacy tiers

Statements live in the author's pod under WAC/ACP. The design names four
sharing tiers (an app-level convention over plain WAC, not new ACL machinery):

1. **Private** — default on creation; drafts.
2. **Community** — Read granted to a named community's aggregator agent +
   members group; enters that community's deliberations only.
3. **Federated** — Read public, announced to any community the author joins.
4. **Anonymous-contributed** — the statement is *re-authored* by a
   pseudonymous WebID the person controls (see 02 §5); the link between the
   person's primary and pseudonymous WebIDs never leaves their pod.

## Vocabulary sketch (Turtle, abridged)

```turtle
@prefix fut:  <https://w3id.org/jeswr/sectors/futures#> .
@prefix core: <https://w3id.org/jeswr/core#> .
@prefix gufo: <http://purl.org/nemo/gufo#> .

<https://w3id.org/jeswr/sectors/futures> a owl:Ontology ;
    owl:imports <https://w3id.org/jeswr/core> ;
    owl:versionInfo "0.1.0" ;
    owl:versionIRI <https://w3id.org/jeswr/sectors/futures/0.1.0> .

fut:VisionStatement a owl:Class, gufo:SubKind ;
    rdfs:subClassOf core:InformationResource ;
    skos:definition "A person's own description of their ideal future."@en .

fut:Claim a owl:Class, gufo:SubKind ;
    rdfs:subClassOf core:InformationResource ;
    skos:definition "An atomic, voteable statement — the deliberation unit."@en .

fut:Need a owl:Class, gufo:SubKind ;
    rdfs:subClassOf core:InformationResource ;
    skos:definition "A need or want felt by the author, linked to a need-scheme concept."@en .

fut:Satisfier a owl:Class, gufo:SubKind ;
    rdfs:subClassOf core:InformationResource ;
    skos:definition "A culturally-specific way of meeting one or more needs."@en .

fut:Resonance a owl:Class, gufo:SubKind ;
    rdfs:subClassOf core:Record ;
    skos:definition "A tri-state reaction (resonates/conflicts/unsure) to a statement."@en .

fut:Deliberation a owl:Class, gufo:EventType ;
    rdfs:subClassOf prov:Activity ;
    skos:definition "A scoped convergence exercise within a community."@en .

fut:SharedFuture a owl:Class, gufo:SubKind ;
    rdfs:subClassOf core:InformationResource, prov:Entity ;
    skos:definition "A synthesized shared-future statement carrying provenance, per-cluster endorsement evidence, and a mandatory dissent annex."@en .

fut:satisfies    a owl:ObjectProperty ; rdfs:domain fut:Satisfier .
fut:needConcept  a owl:ObjectProperty ; rdfs:domain fut:Need ; rdfs:range skos:Concept .
fut:onStatement  a owl:ObjectProperty ; rdfs:domain fut:Resonance .
fut:stance       a owl:ObjectProperty ; rdfs:domain fut:Resonance .
fut:dissent      a owl:ObjectProperty ; rdfs:domain fut:SharedFuture ; rdfs:range fut:DissentRecord .
fut:motivatedBy  a owl:ObjectProperty . # AppProposal → Need/ValueStatement
```

The full sector (OWL + `futures.shacl.ttl` + alignments to AS2/SKOS/PROV/ODRL
+ JSON-LD context) is authored during Stage-1 build, PR'd into
`solid-federation-vocab/sectors/futures/` under the sector contract, and
version-pinned by implementations via `fedreg:acceptsSpec`.

## SHACL profile — the MUSTs (abridged)

- A `fut:Claim` MUST have exactly one `as:content` (≤ 500 chars — atomicity),
  one creator, one `dct:created`.
- A `fut:Resonance` MUST have exactly one `fut:onStatement` and one
  `fut:stance` from the coded set.
- A `fut:SharedFuture` MUST have ≥1 `prov:wasDerivedFrom`, ≥1
  `fut:bridgingEvidence`, a Data Integrity proof, and **either ≥1
  `fut:dissent` or an explicit `fut:noDissentRecorded true`**.
- A `fut:AppProposal` MUST have ≥1 `fut:motivatedBy`.
- A `fut:SpecSynthesis` MUST link every `fut:acceptanceCriterion` to a
  `fut:Need`.
