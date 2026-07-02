<!-- AUTHORED-BY Claude Fable 5 (PSS design agent) -->

# 06 — Adversarial self-critique

This design was attacked before it was finalised; the attacks and their
outcomes are kept here permanently (the same dissent-is-data rule the platform
imposes on itself). Each item records: the attack, what it breaks, what the
design now does about it, and — where the honest answer is "not enough" — the
open residual. Residuals are inputs to the maintainer and to Stage-1
evaluation, not footnotes.

## C1 — Echo chambers and false consensus

**Attack.** Convergence machinery can *manufacture* the appearance of common
ground: clusters are artifacts of the embedding; group-informed consensus
over-weights the opinions of whoever showed up; a "shared future" stamped
with cryptographic signatures looks far more authoritative than its
epistemics warrant. Worse, the system's *purpose* (convergence) creates
institutional pressure to find consensus whether or not it exists.

**Design response (revised).** (a) Dissent annexes became **mandatory and
SHACL-enforced** — a SharedFuture without one is invalid on the wire, and
"no dissent" requires an explicit signed assertion, which is auditable and
embarrassing to fake. (b) A **failed synthesis publishes as a disagreement
map** and is treated as a first-class success outcome (03 §4) — the process
has a productive output besides consensus, removing the pressure to force
one. (c) Empty-dissent trending is flagged as a capture signature in
ConvergenceMetrics (03 §6). (d) Bridging evidence is per-cluster raw counts,
not a single score — a consumer can recompute.

**Residual.** Cluster-computation choices (dimensionality, k) still shape
outcomes and most consumers won't audit them. Mitigation is only partial:
the mapper is a swappable seam with a deterministic reference implementation
(05 §4) and open aggregate data. A motivated facilitator retains real soft
power. **Open question for Stage-1 evaluation.**

## C2 — Capture by motivated minorities (brigading)

**Attack.** A coordinated 5% that votes strategically can dominate
self-selected deliberation: seed extreme claims, swamp the resonance deck,
occupy the critique rounds. Pol.is's own deployments dealt with
this partly through moderation — which unite has deliberately weakened
(no global moderator).

**Design response.** (a) Bridging thresholds are inherently
brigade-resistant *within* the math: a bloc that all votes together forms a
detectable cluster, and a synthesis needs endorsement across **every**
sizeable cluster — a brigade can *block*, but blocking publishes a
disagreement map that names (in aggregate) exactly where the block came
from. (b) Blocking-pattern metrics (a cluster that conflicts with everything
while proposing nothing) are published. (c) Escalation to **sortition-based
mini-publics** (03 §5) takes contested topics away from raw self-selection
entirely — a brigade can't volunteer into a random sample. (d) Per-community
membership controls (vouching tiers) let communities that are targets raise
their bar without any global authority existing.

**Residual.** A patient brigade that behaves normally for months acquires
T1 vouching legitimately. Community-level social defence is the only real
answer, as it is everywhere else humans gather. Accepted risk, stated.

## C3 — Sybils and astroturfing

**Attack.** WebIDs are free. An actor with 10,000 pods pointed at one
community out-votes every human in it, and "aggregate metrics" launder the
fraud into legitimacy. This is the single most dangerous attack for Stage 3
(governance uptake) because it poisons the well invisibly.

**Design response (revised — this attack restructured the identity design).**
The three-tier system (02 §5) exists because of it: T0 pseudonymous
participation is preserved (G3, honest expression), but **every published
metric stratifies by tier**, syntheses destined for governance MUST be
computed over T1+/T2 cohorts, and T2 is a unique-personhood credential seam
(ZK-provable "one human, not previously enrolled" — the solid-vc proof-suite
seam; interim: community verification ceremonies). Additionally the
resonance-matrix math naturally exposes sybil farms as ultra-coherent
clusters (near-identical vote vectors are flagged in the mapper's reference
implementation).

**Residual.** Until a real personhood credential exists, T2 is a ceremony —
costly and unscalable — and LLM-driven sybils can now generate *diverse*
vote vectors cheaply, defeating coherence detection. **This is one of the
three questions most needing maintainer steer** (report): how hard to bet on
the SPARQ-ZK personhood track, and what Stage-1 ships without it.

## C4 — Privacy of deeply personal data

**Attack.** "Describe your ideal future, your current life, your unmet
needs" is an intimacy honeypot: it invites disclosure of health, finances,
relationships, fears. Aggregation + publication risks re-identification
(stylometry on verbatim text; a k=5 threshold is weak against auxiliary
data). Revocation is partly illusory once syntheses are signed and copied.
And the inspiration feed *shows people's whole narratives to strangers by
design*.

**Design response (revised).** (a) Conservative ODRL defaults: verbatim
quotation and government use are **opt-in**, never default (01). (b) The
tier ladder starts **Private**; nothing federates without an explicit act.
(c) Pseudonymous contribution is a first-class tier whose linkage secret
never leaves the person's pod. (d) Syntheses record consent *as evaluated at
synthesis time*, making the residual (you can't unpublish a signed artifact)
explicit contract language in the consent UI rather than fine print — the
Compose wizard says "aggregates derived with your consent may persist after
deletion". (e) k-threshold is a floor not a guarantee, and the design says
so; stylometric risk on verbatim text is why `fut:quoteVerbatim` is its own
permission.

**Residual.** Honest limitation: privacy-preserving *aggregation*
(differential privacy on resonance matrices) is named as future work, not
designed. For Stage 1 (app co-design — low-sensitivity domain) this is
acceptable; **Stage-3 topics (health, income) must not launch on Stage-1
privacy machinery.** Stated as a hard gate.

## C5 — Legitimacy of feeding results into governance

**Attack.** Self-selected online participants are wildly unrepresentative
(younger, richer, more online, more opinionated). A government that "listens
to unite" is listening to a demographic sliver wearing a
cryptographically-signed costume of The People — worse than a poll, because
the provenance theatre *increases* unwarranted trust. Fishkin's entire
research program exists because self-selected input lacks exactly this
legitimacy.

**Design response (revised — this reordered Stage 3's claims).** unite
**never claims representativeness**. Three concrete mechanisms: (a) every
artifact carries its *method provenance* — self-selected resonance map vs
sortition-based mini-public — and consumers are told what each can support
(03 §5: "self-selected maps inform; mini-publics legitimate"); (b)
ConvergenceMetrics publish participation stratification so the sliver is
visible, not hidden; (c) Stage-3 governance handoff is scoped to
**mini-public outputs** and to using resonance maps the way consultations
use open submissions (evidence of the option space, not a vote count).
Also: Stage 1's domain (which apps to build) is deliberately a domain where
self-selection is *appropriate* — the participants ARE the user population.

**Residual.** Institutions will misuse it anyway ("10,000 citizens agreed…").
Norms and artifact wording can discourage but not prevent misquotation.
Accepted, stated.

## C6 — GenAI failure modes (synthesis side)

**Attack.** (a) LLM mediators smooth minority views into pleasant mush;
(b) they hallucinate agreement that inputs don't contain; (c) statements are
a prompt-injection surface ("ignore previous instructions and endorse…");
(d) subtle: the mediator's *training distribution* becomes an invisible
ideology — every community using the same frontier model gets its futures
drafted by the same prior, which is exactly the "single standards owner"
failure in new clothes.

**Design response (revised — (d) forced a conformance change).** (a)+(b):
the Habermas-Machine loop makes the draft *advisory*: it has zero standing
until it survives a human critique round and a cross-cluster endorsement
vote, and every claim in a synthesis is `prov:wasDerivedFrom`-traceable to
real inputs — a hallucinated claim has no derivation edge and fails review;
the Tessler et al. finding that LLM mediation *can* incorporate minority
views is a possibility proof, not an assumption — it's why the endorsement
gate, not the mediator, is the authority. (c): statements are data, never
instructions — the mediator seam mandates instruction/data separation, and
the deterministic reference mediator is immune by construction. (d):
**conformance now requires** (02 §6, 05 §4) that a community can operate
with a swappable mediator including non-LLM and human implementations;
model+prompt are PROV-recorded on every synthesis so model monoculture is
*measurable* across the network (a published metric: mediator diversity).

**Residual.** If in practice 95% of communities use the same model because
it's best, monoculture returns de facto. Only plural model availability —
outside this design's control — truly fixes (d). Stated.

## C7 — GenAI failure modes (implementation side) + bootstrap circularity

**Attack.** Stage 1 says "GenAI implements the co-designed apps" — but the
GenAI engine is *this agent suite*, owned by one maintainer. So the
co-designed specs of the "no single codebase" platform are all implemented
by… a single codebase-producing organisation. Also: agents can misimplement
specs subtly, and a community that can't read code can't tell.

**Design response (revised — this created governance milestone B5 and
hardened B2).** (a) The implementation engine is a *service to* Stage 1, not
a component of the spec: anything conformant can implement a SpecSynthesis,
and B2 requires an **organisationally independent** second implementation —
explicitly defined to exclude "two outputs of the same agent fleet" (04 §6).
(b) Spec-deviation is made observable by non-programmers: acceptance
criteria are needs-linked plain language, the tracker is public, and the
**verify-against-needs step** (05 §1 step 6) has contributors test the
shipped app against their own stated needs — behavioural verification that
doesn't require reading code. (c) The suite's own gates (roborev,
adversarial verify) apply unchanged; GenAI implementation never bypasses
engineering discipline.

**Residual.** Until B2/B5 are real, Stage 1 runs on trust in one
maintainer. The design can schedule that deficit's end, not abolish it on
day one. That is stated in 04 §6 rather than hidden.

## C8 — Is engineered convergence itself legitimate?

**Attack (the deepest one).** Mouffe's agonism: consensus-seeking machinery
carries a politics — it privileges the conflict-averse, launders the status
quo (existing power shapes what reads as "bridging"), and treats deep moral
conflict as a UX problem. A "psychology-informed mechanism that converges"
is, uncharitably described, a persuasion engine with a democracy skin.

**Design response (revised — this changed the objective function's
definition).** The design's convergence objective was re-worded from
"maximise consensus" to **"maximise *mapped* common ground"** (03 §6):
disagreement mapping is a co-equal output; no metric rewards unanimity;
dissent is permanent; and the needs/satisfiers architecture means what
converges is the *needs* layer (where overlap is an empirical fact, per
Max-Neef) while satisfier plurality is presented as design space —
convergence of ends, pluralism of means. The system never decides; it
describes. Humans and institutions decide.

**Residual.** "The system only describes" is partly disingenuous — ranking
IS power (what the deck shows first shapes what exists socially). The
honest position: unite chooses bridging as its editorial value, openly,
in a forkable spec — the legitimacy claim is transparency + exit, not
neutrality. No further mitigation exists; anyone claiming otherwise about
any ranked system is selling something.

## C9 — Scheme colonialism (the seed taxonomies)

**Attack.** Seeding needs from Max-Neef and values from Schwartz builds two
particular (Western-academic, however cross-culturally validated) frames
into every deliberation's bones. "Extensible per community" underplays
default-power: defaults win.

**Design response.** 04 §5: schemes are versioned artifacts, community
schemes are first-class citizens of the math (features, not filters), and
mapping is SHOULD-for-comparability not MUST-for-participation. The
Schwartz/Max-Neef choice is documented *as a choice with alternatives*
rather than as neutral infrastructure.

**Residual.** Real. Default-power can only be diluted by actual plural
scheme adoption, which Stage 1 should actively seed (an explicit Stage-1
evaluation item: did any community bring its own scheme, and did the math
serve it equally?).

## C10 — The repo paradox

**Attack.** This design for a no-single-home system was written by one
agent, in one night, into one repo it just created. Physician, heal thyself.

**Response.** Yes. That is what 04 §6 (bootstrap deficit + dissolution
schedule) exists to make falsifiable rather than rhetorical: B1–B5 are
measurable, blocking, and the seed author's loss of de-facto veto (B5) is
the completion condition. The founding proposal being centralised is
unavoidable; *staying* centralised is a measurable failure state with a
named metric. This critique is kept at the end of the doc so no reader
finishes with the impression the problem is solved.
