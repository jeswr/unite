<!-- AUTHORED-BY Claude Fable 5 (PSS design agent) -->

# 03 — The convergence mechanism

The brief's essential requirement: psychology-informed design so the system
supports people building toward **shared** futures rather than divergent ones.
This doc specifies the mechanism as a five-step pipeline, grounds each step in
the literature, and — because "engineering convergence" is itself a dangerous
idea — closes with the guardrails that keep convergence from becoming
manufactured consensus (expanded adversarially in [06-critique.md](06-critique.md)).

**Citation practice:** the works below are real and load-bearing; page-level
claims should be re-verified against the sources before any academic
publication of this design. This is a design document, not a literature
review.

## 0. Why engagement-ranking diverges and what replaces it

Recommender systems that optimise engagement preferentially amplify
divisive content, because outrage engages. Ovadya's **bridging-based
ranking** proposal replaces the objective: rank content by whether it earns
*positive reception across divides*, not raw engagement (Aviv Ovadya,
*Bridging-Based Ranking*, Harvard Belfer Center, 2022; Aviv Ovadya & Luke
Thorburn, *Bridging Systems: Open Problems for Countering Division and
Building Positive-Sum Futures*, arXiv:2301.09976, 2023). The deployed
existence proof is X/Twitter's **Community Notes**: its matrix-factorisation
model decomposes ratings into a *polarity* dimension and a *helpfulness*
dimension, and only surfaces notes rated helpful by raters **across** the
polarity spectrum (Stefan Wojcik et al., *Birdwatch: Crowd Wisdom and Bridging
Algorithms can Inform Understanding and Reduce the Spread of Misinformation*,
arXiv:2210.15723, 2022). unite adopts bridging as **the** ranking objective
everywhere content is ordered — the inspiration feed, the resonance deck, and
synthesis endorsement all rank by cross-cluster reception. There is no
engagement-ranked surface anywhere in the design.

## 1. Elicitation — visions → atomic claims, needs, and values

People write narrative `fut:VisionStatement`s / `fut:LifeContext`s freely —
the honest, personal, whole-story form matters psychologically (self-authored
future narratives, not multiple-choice). But narratives don't aggregate. So a
**decomposition step** (GenAI-assisted or manual) derives:

- atomic `fut:Claim`s (the Pol.is deliberation unit — one idea, voteable),
- `fut:Need`s tagged against the need scheme,
- `fut:ValueStatement`s tagged against the value scheme.

Grounding: Pol.is demonstrated that short, atomic, participant-authored
statements + simple votes scale open-ended deliberation to thousands while
staying machine-mappable (Christopher Small, Michael Bjorkegren, Timo
Erkkilä, Lynette Shaw & Colin Megill, *Polis: Scaling Deliberation by Mapping
High Dimensional Opinion Spaces*, **Recerca** 26(2), 2021; deployed at
national scale in Taiwan's **vTaiwan** process, e.g. the 2015–16 UberX
regulation case). The decomposition into *needs* follows Max-Neef (§2).

**Consent invariant (from critique C6):** GenAI-derived claims are drafts;
nothing is attributed to a person until they explicitly adopt it
(`fut:adoptedBy`, 01). The decomposition model is recorded as `prov:Plan`.

## 2. The convergence substrate — needs and values, not positions

Two psychology literatures give convergence something real to converge *on*:

- **Max-Neef's needs/satisfiers distinction.** Manfred Max-Neef, Antonio
  Elizalde & Martín Hopenhayn, *Human Scale Development: Conception,
  Application and Further Reflections* (Apex Press, 1991): fundamental human
  needs are **few, finite, and universal** (subsistence, protection,
  affection, understanding, participation, idleness, creation, identity,
  freedom); what varies across cultures and ideologies is the **satisfiers**.
  Positions ("ban cars") are satisfier-level and collide; the needs beneath
  them ("safety, clean air, mobility, autonomy") overlap massively. unite's
  data model separates the layers (01), and the convergence math computes
  common ground **needs-first**: two clusters that reject each other's
  satisfiers but share needs get that shared-needs map surfaced *before* any
  satisfier debate. Satisfier diversity is then presented as a portfolio
  ("here are four ways different people meet this shared need"), which
  reframes disagreement as design-space, not conflict.
- **Schwartz's basic values.** Shalom H. Schwartz, *Universals in the Content
  and Structure of Values* (Advances in Experimental Social Psychology 25,
  1992): a small set of basic values with a stable circumplex structure
  (adjacent values compatible, opposing values in tension), replicated across
  dozens of cultures. Seeding the value scheme from Schwartz gives cluster
  interpretation psychological meaning ("this cluster weights security +
  tradition; that one self-direction + universalism") and lets the UI show
  *value* proximity between people whose *positions* differ — a documented
  depolarisation lever (perceived value similarity increases openness).

Two corrective findings shape the *presentation* layer:

- **False polarisation / the perception gap.** Partisans systematically
  overestimate the other side's extremity (Daniel J. Ahler & Gaurav Sood,
  *The Parties in Our Heads*, Journal of Politics 80(3), 2018; More in
  Common, *The Perception Gap*, 2019). Mechanism: unite always shows **actual
  resonance distributions** (the whole histogram, all clusters) rather than
  exemplar opponents — showing people the real distribution is one of the few
  interventions known to shrink the gap.
- **Intergroup contact.** Contact reduces prejudice under Allport's
  conditions — equal status, common goals, cooperation, institutional support
  (Gordon Allport, *The Nature of Prejudice*, 1954; Thomas Pettigrew & Linda
  Tropp's meta-analysis, *A Meta-Analytic Test of Intergroup Contact Theory*,
  JPSP 90(5), 2006). The inspiration feed operationalises this: it
  preferentially routes you *whole vision narratives* (not decontextualised
  hot takes) from people **outside your opinion neighbourhood whose need/value
  profile overlaps yours** — contact through the lens of what you share,
  cooperative framing (you're co-designing futures, a superordinate goal in
  Sherif's sense — Muzafer Sherif, *The Robbers Cave Experiment*, 1954/1961).

## 3. Resonance mapping — the Pol.is layer

Participants react to atomic statements with resonates / conflicts / unsure
(`fut:Resonance`, 01). Following Small et al. (2021):

- the resonance matrix (participants × statements) is dimensionality-reduced
  (PCA in Pol.is; implementations may use UMAP) and clustered (k-means) into
  **opinion clusters**;
- **group-informed consensus** statements — high resonance in *every*
  cluster — are computed and surfaced first;
- **statement routing** is active-learning-driven as in Pol.is, with unite's
  bridging prior: you're preferentially shown statements your cluster hasn't
  assessed and that neighbouring clusters resonated with — cheap information
  gain *and* engineered cross-exposure;
- there are deliberately **no replies** at this layer (a Pol.is design
  decision that removes the flame-war surface entirely; threaded discussion
  exists only inside facilitated synthesis rounds, §4).

Sunstein's **law of group polarization** — deliberation among the
like-minded predictably moves groups to more extreme positions (Cass R.
Sunstein, *The Law of Group Polarization*, Journal of Political Philosophy
10(2), 2002) — is the standing threat model for any community feature. unite's
answer is structural: clusters are *computed, cross-cut, and always co-present
in every view*; there is no cluster-only room. Diana Mutz's finding that
cross-cutting exposure and participatory zeal trade off (*Hearing the Other
Side*, Cambridge, 2006) is accepted as a real cost: unite optimises for
understanding-weighted participation, not raw activity.

## 4. Synthesis — the mediated common-ground draft

When a deliberation's resonance map stabilises, a **mediator** — GenAI or
human, always PROV-attributed — drafts candidate `fut:SharedFuture`
statements that maximise *predicted cross-cluster endorsement*.

Grounding: the **"Habermas Machine"** (Michael Henry Tessler et al., *AI can
help humans find common ground in democratic deliberation*, **Science** 386,
2024): an LLM mediator that drafts group statements from individual opinions
+ critiques, iterating; its group statements were preferred by participants
over human mediators' and measurably increased agreement — critically, it was
shown to **incorporate minority perspectives** rather than average them away.
unite adopts its loop shape:

1. mediator drafts from consenting inputs (ODRL-checked);
2. **critique round** — participants (stratified across clusters) submit
   critiques; dissents are captured *as data*;
3. mediator revises (bounded rounds, default 3);
4. **endorsement vote** — the candidate becomes a `fut:SharedFuture` only if
   it clears a **bridging threshold**: minimum resonance in *every* cluster
   above minimum size (Community-Notes-style: cross-polarity approval, not
   majority), with quorum rules per community;
5. surviving objections become the **mandatory dissent annex**
   (`fut:DissentRecord`); a failed candidate publishes as a *disagreement
   map* — an explicitly valuable artifact ("here is exactly where we
   divide, and on which needs we nonetheless agree").

Habermasian grounding and its limit: the design aims at something like the
force-of-the-better-argument ideal (Jürgen Habermas, *The Theory of
Communicative Action*, 1981) but takes Mouffe's agonistic critique seriously —
consensus can be a mask that suppresses legitimate conflict (Chantal Mouffe,
*The Democratic Paradox*, Verso, 2000). Hence: dissent annexes are mandatory
and permanent, "we mapped our disagreement" is a first-class success outcome,
and no metric rewards unanimity (§6).

## 5. Escalation — deliberative mini-publics

For contested or Stage-3-bound topics, communities convene **mini-publics**:
a stratified random sample (sortition) of the deliberation's participants,
balanced briefing materials (drawn from the disagreement map — both/all
clusters' framings), facilitated small-group sessions, then the §4 loop with
the mini-public as the endorsing body.

Grounding: **deliberative polling** — James S. Fishkin, *When the People
Speak* (Oxford, 2009) and the *America in One Room* experiment (Fishkin &
Diamond, 2019): random, informed, facilitated deliberation reliably produces
large, durable opinion change and depolarisation, and its outputs carry a
legitimacy that self-selected input cannot (the counterfactual-representative
"what the public *would* think" claim). This is also the design's honest
answer to self-selection bias (critique C5): **self-selected resonance maps
inform; sortition-based mini-publics legitimate.** Anything forwarded to
governance carries which of the two produced it.

**Value-sensitive design** governs who is in the room: Batya Friedman & David
G. Hendry, *Value Sensitive Design: Shaping Technology with Moral Imagination*
(MIT Press, 2019) — its tripartite (conceptual/empirical/technical)
investigations and its insistence on **indirect stakeholders** (people
affected who aren't users) are baked into the Stage-1 co-design template:
every `fut:SpecSynthesis` must name indirect stakeholders and how their needs
were considered (05).

## 6. Convergence as a measured constraint — with anti-gaming guardrails

"Converge, don't diverge" is a testable property, monitored per deliberation
and published as `fut:ConvergenceMetrics` (01):

- **cross-cluster consensus rate** (share of claims with group-informed
  consensus) and its trend;
- **bridging-score distribution** of surfaced content (is the feed actually
  bridging?);
- **perception-gap delta** where measured (pre/post estimates of other
  clusters' views);
- **participation stratification** (per verification tier, per cluster).

Guardrails, because each metric invites its own pathology:

- **No unanimity target.** The objective is maximising *mapped common ground*,
  never minimising dissent. A community whose consensus rate rises while its
  dissent annexes empty out is flagged, not celebrated (empty dissent is the
  signature of conformity pressure or capture, critique C1).
- **Blandness check.** Group-informed consensus tends toward the anodyne
  ("we all want good things"). Syntheses carry an *informativeness*
  requirement: each must be traceable to acceptance-criteria-grade content
  (01 SHACL: SpecSynthesis criteria link to needs), and "motherhood"
  statements — resonant everywhere but consequence-free — are demoted by
  requiring at least one *rejected alternative* to be named per synthesis.
- **Metrics are open data** (k-anonymous), so a community's convergence
  claims are independently auditable.
