<!-- AUTHORED-BY Claude Fable 5 (PSS design agent) -->

# 04 — Circles: how diverse communities form (and stay diverse)

The brief's goal (b): form DIVERSE communities who collaborate to build a
good future. The sociology is blunt about the default outcome without
deliberate mechanics: homophily is gravity (McPherson et al. 2001),
like-minded rooms polarize (Sunstein 2002; Schkade, Sunstein & Hastie
2007), one big room hands the floor to the loudest 1% (Nielsen 90-9-1;
Karpowitz & Mendelberg 2014). So v2's atomic social unit is the **circle**:
a small group, deliberately composed, warmly framed, invisibly maintained.

## 1. What a circle is

3–6 people (beyond ~4 active speakers conversation fragments; 6 tolerates
async lurking), one standing topic-thread with the notetaker present,
async-first. Every circle is framed as **co-creation, not discussion**: it
exists to produce something small and shared — a sketch of "the street we
want", a question list for an engineer, one paragraph of "what we agree
matters". Interdependent tasks bridge; mere contact doesn't (Sherif;
Putnam). The artifact focus also gives the synthesis loop (03 §5) its
natural object.

## 2. Composition: the engine picks who meets (sortition in a cardigan)

Circle composition is the v2 design's central *new* use of the existing
engine — using it for **composition, not just ranking** (composition and
decision rules, not content, determine who speaks — Karpowitz &
Mendelberg):

- Input: the community's resonance matrix → `cluster()` (the shared
  opinion space) + per-person need profiles (`gallery.needProfile` — the
  concepts a person authored or resonated with).
- Constraint: each circle spans clusters (**diverse**) with non-empty
  shared need concepts (**bridgeable**) — Max-Neef overlap is what they'll
  discover they share; cluster spread is what makes discovering it worth
  anything. Diversity is enforced silently as a *safety property* (a
  homogeneous circle is a polarization hazard, not a preference).
- Implementation: a new pure module `lib/circles.ts` (07 §4) —
  deterministic, exhaustively tested, no ML: partition participants so
  every circle of size 3–6 contains ≥2 clusters where the community has
  ≥2 clusters, maximizing min-shared-need-concepts within circles, total
  deterministic tie-breaks (the house engine style).
- Cold start (no votes yet): compose on need-profile overlap alone from
  the first mirrors, re-balance as the matrix fills in. Newcomers join
  existing circles with an open seat that maximizes the same objective.

The framing never mentions the mechanism unprompted — *"a few people
thinking about similar things from different places"* — but the seam is
always there (P5): **"why this circle?"** → *"This circle was put together
to span the community's different ways of seeing this street — you were
invited because you and Rosa care about some of the same things and read
the traffic question differently."* And the full mechanism lives on How
unite listens. Composition is exactly the function the tyranny-of-
structurelessness critique says must never be an invisible informal power
(Freeman 1972) — which is why it is deterministic, documented, and
seam-carried rather than vibes-based.

## 3. Contact conditions as chat defaults (Allport, operationalized)

The four empirically-validated conditions (Allport 1954; Pettigrew &
Tropp 2006) are *settings*, not aspirations:

| Condition | v2 default |
|---|---|
| equal status | no visible karma/rank/tier inside a circle; tier machinery surfaces only on governance outputs (v1's stratify-and-disclose is an *output* property); expert credentials appear on experts, who are guests, not members (05 §2) |
| common goals | the circle artifact (§1) — every circle has one |
| cooperation | prompts are joint ("what would we tell the council together?"), never adversarial; no debate framing anywhere |
| institutional support | the notetaker's light facilitation + host norms (§4); the community's house rules (§7) |

## 4. Invisible maintenance (the health metrics that never become dashboards)

- **Airtime equity** — the strongest known predictor of group collective
  intelligence is equal turn-taking (Woolley et al. 2010). The notetaker
  tracks talk-share per circle *as a hidden health metric* and repairs
  conversationally: a gentle open-door ("we haven't heard from everyone —
  no pressure, Sam, but the floor's yours if you want it"), never a
  leaderboard, never a public stat. Optimize silently; display never.
- **Hidden-profile correction** — the engine knows which perspectives a
  circle hasn't heard (cluster-typical statements with no counterpart in
  the circle): the notetaker prompts *"you're the first here to bring this
  up"* (novelty as a gift) or routes a cross-cluster story via the gallery
  ("Dana sees this differently — want to hear why?", person-mediated,
  narrative — Broockman & Kalla, never raw opposing content per Bail 2018).
- **Dissent kept cheap and dignified** — every "we seem to agree" moment
  carries a private one-tap *"actually, I don't"* (feeds the matrix as an
  honest Conflicts; guards against Abilene/spiral-of-silence conformity),
  and the notetaker periodically invites the missing voice explicitly
  ("what would someone who disagrees say?"). Warmth in tone, honesty in
  content — the irony-of-harmony failure (commonality-focused positivity
  demobilizing grievance) is a named antipattern with a named guard: the
  differ-block is mandatory in every summary (P7).
- **Calibration honesty** — nothing ever displays consensus stronger than
  measured (`candidateReception` computes; copy renders its verdict and
  nothing more). Miscalibrated perception of others' views is the disease
  (false consensus / pluralistic ignorance); calibrated perception is the
  core civic product.

## 5. Growth: the ladder, not the funnel

- **Reader → reactor → speaker → host, by invitation.** Lurking is
  legitimate participation (the letter is a full civic surface, P10); the
  ladder's rungs are personal invitations, never guilt ("Rosa thought
  you'd have something to say about mornings" beats every broadcast CTA
  ever sent). No engagement notifications, no streaks, no neighbor-
  comparison (Gerber, Green & Larimer 2008's backlash; Kristofferson et
  al. 2014's slacktivism licensing).
- **The one growth loop is "bring someone who sees this differently."**
  A first-class, gracious act, prompted in the letter (02 §6) and at
  natural moments; it recruits *diversity* rather than reach, which is the
  only growth the bridging math even wants.
- **Host development is the growth metric that matters** (Han 2014:
  organizing, not mobilizing): the engine flags high-commitment bridging
  participants (steady presence + cross-cluster resonance earned) as
  candidate hosts/stewards; a steward extends a personal, specific,
  time-boxed ask. Measured: leaders developed, loops closed — never
  clicks, taps, or session counts.
- **Pilot cohorts are curated, not open-signup** (the vision-prototype
  stance): each seeded community starts with ~25% committed norm-carriers
  who model the culture — warm, story-first, honestly dissenting
  (Centola's tipping-point threshold). This is also the honest answer to
  the who-showed-up problem at demo scale: a curated pilot *is* a
  convenience sample and is labeled as one (per v1's method-provenance
  discipline).

## 6. Federation of circles (identities kept, never merged)

Circles federate upward into the community letter; communities federate
across the existing unite substrate (design/02 — registries, peer
vouching, pods). Each keeps its own name, voice, and house style
(dual-identity: affiliation to the shared future-building project without
assimilation — Brewer; Dovidio; Ostrom's nested enterprises). "We're all
one community now" copy is banned; distinctiveness threat drives exactly
the minority disengagement the diversity goal cannot afford. Exit rights
are real and pod-backed (leave with your data; fork the circle; the v1
capture audit applies unchanged).

**Honesty flag:** circle composition (§2) is this design's own mechanism —
assembled from validated ingredients (sortition's stratification logic,
the contact conditions, the existing clustering) but not itself a
literature-validated procedure, and unproven at any scale. It joins the
expert-review checklist with a concrete failure mode to watch: at demo
scale (n≈9 personas) the "partition" is nearly the whole community and
diversity constraints can be vacuously satisfied; at real scale,
min-cluster-size floors (already `bridgingScore` parameters) must gate
which spans count. See 08-critique C-v2-4.

## 7. Self-governance (Ostrom-shaped, deferred-but-designed)

Each community writes and adjusts its own house rules (collective choice);
sanctions are graduated and restorative (the notetaker de-escalates first;
stewards act second; removal is a two-steward action per v1 §4.4);
conflict resolution is cheap and fast (a named path, not a courtroom); and
the right to self-organize — fork, federate, leave with the data — is
constitutionally guaranteed by the substrate (design/02 §6, design/04 §4).
v2 adds no new governance machinery; it inherits v1's and gives it warmer
clothes. Build phasing: V4 (07 §3).
