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

**4–6 people** (4 is the diversity floor — §2's pairs rule times two
clusters is 4, so a "diverse circle of 3" is arithmetically impossible and
not a supported shape; beyond ~4 active speakers conversation fragments,
so 5–6 works because async lurking is legitimate), one standing
topic-thread with the notetaker present, async-first. Every circle is framed as **co-creation, not discussion**: it
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
  deterministic, exhaustively tested, no ML. Its guarantees, arithmetically
  consistent by construction:
  - circles are size **4–6**;
  - where the community has ≥2 composition clusters, every circle spans
    ≥2 of them, **and every cluster represented in a circle seats ≥2 of
    its members** — the pairs rule (a lone token minority violates
    Allport's equal-status condition *by composition*; 08 C-v2-4). Four
    is the floor precisely because pairs × two clusters = 4; the earlier
    "size 3–6 + never exactly one of a cluster" spec was arithmetically
    impossible at size 3 and is corrected here;
  - clusters too small to pair community-wide (size < 2, or under the
    same `minClusterSize` floor `bridgingScore` already takes) are
    **folded into their nearest cluster centre** for composition purposes
    (deterministic) — nobody is ever seated as "the different one";
  - objective: maximize min-shared-need-concepts within circles; total
    deterministic tie-breaks (the house engine style).
  - **best-effort-diverse, with an honest seam when it can't be
    (the fallback — FINDING-1 fix).** A full diverse partition is not
    always arithmetically possible: an imbalanced community (say 6 in
    cluster A, 2 in B) can seat at most one diverse circle before the
    minority cluster is exhausted, leaving A-only members with no B
    partner. The composer therefore runs **greedily and deterministically**:
    (1) sort clusters by size; (2) form diverse circles first, each
    drawing ≥2 from the minority cluster being paired and filling to size
    4–6 while the pairing holds; (3) when a cluster can no longer be
    paired (its diverse partners are exhausted), the leftover members form
    **homogeneous overflow circles** — size 4–6, deterministic, **each
    seeded with open seats** (target size 4, capacity 6) reserved for
    later-arriving diverse members; (4) any tail below 4 joins the nearest
    existing circle with an open seat, or waits on a **community waitlist**
    until enough people exist to compose (never a circle of 1–3). An
    overflow circle is **labeled as such in its own seam** — it never
    borrows the diversity sentence it can't honor:
    > *"why this circle?"* → **overflow variant:** *"Right now this circle
    > is people who see the street pretty similarly — we didn't have
    > enough differing voices to pair everyone yet. There are open seats
    > held for people who read it differently; the notetaker will route
    > their stories here in the meantime, and re-pair when the seats
    > fill."*
    Open seats are filled by the same objective as a newcomer join
    (seat-filling is the one recomposition the continuity rule permits,
    below); until then, cross-cluster exposure into an overflow circle is
    carried by **routed stories** (the deck/gallery beats, 03 §3), not by
    reshuffling people. This keeps the pairs rule intact (no lone token is
    ever seated) *and* keeps the composer total — it always returns a
    valid partition, honestly labeled, for any community shape.
- Cold start (no votes yet): compose on need-profile overlap alone from
  the first mirrors. A community below 4 participants — or before any
  clustering exists — gets a **starter circle** that claims nothing: its
  seam says *"this circle is everyone so far — composition starts when
  there are enough people to compose"*, never the diversity sentence (a
  seam must not claim a property the composer couldn't enforce).
- **Relational continuity beats re-balancing.** Composition runs at
  circle CREATION and when filling an open seat (a newcomer, a
  departure) — it never reshuffles standing circles to chase the drifting
  opinion map. The contact literature's effects are longitudinal:
  sustained relationships with friendship potential are part of the
  mechanism (Pettigrew 1998's fourth condition; Pettigrew & Tropp 2006),
  and a composer that swaps humans to re-optimize a diversity metric
  destroys the very thing the metric is a proxy for. If a standing circle
  homogenizes as views converge, that is common ground — a success, not a
  defect to correct; cross-cluster exposure is maintained by routing
  *stories* into the circle (the deck/gallery beats, 03 §3), which move
  stimuli between rooms instead of moving people. People may leave or
  move voluntarily; open seats refill by the composition objective.

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

**What "diverse" honestly means here.** The engine sees exactly one axis:
the resonance matrix. A "diverse circle" is a **cross-OPINION-cluster**
circle — nothing more. The engine cannot see (and must not be fed)
demographic or social attributes, so a circle can be opinion-diverse and
demographically narrow — and the intake channel makes that likely:
invitation-chain growth recruits through existing social networks, and
homophily runs along race, education, age, and class (McPherson et al.
2001), so the door itself filters before composition ever runs.
Mitigations, weighed honestly: pilot cohorts are curated by the human
partner org (§5) — the only actor who *can* deliberately recruit across
demographic lines, offline; the growth invitation asks for differing
*views*, the one diversity the engine can verify; and every published
output carries v1's method-provenance / convenience-sample label, so
nothing downstream claims a representativeness the intake can't deliver.
The limit stands and is structural: platform-side demographic
stratification would mean collecting protected attributes, which the
privacy posture refuses. Demographic diversity is a recruitment-side,
*human* responsibility — the design says so plainly rather than implying
the engine delivers it (08 C-v2-10).

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
- **Dissent kept cheap, dignified — and unexposable.** Every "we seem to
  agree" moment carries a private one-tap *"actually, I don't"* (recorded
  to a **separate private-tap signal store** — its own container/predicate,
  outside the ordinary `fut:Resonance` universe the circle aggregate
  reads, so the unchanged engine never sees it on the circle read path;
  the Abilene/spiral-of-silence guard). In a 4–6-person room a naive
  version
  would deanonymize the lone dissenter — the summary flips and everyone
  knows who tapped — so the tap is routed to be **structurally invisible
  at circle scale** (03 §4's two-scale rule, the FINDING-3 routing):
  private-tap signals render nothing below a ≥k batch threshold, feed only
  community-scale surfaces (where k-anonymity protects the set), are
  **permanently excluded from the originating circle's own summary**, and
  within that circle drive only the notetaker's missing-voice invitation —
  which is time-decoupled from any tap and fires on a seeded jitter even
  when no one tapped, so neither the prompt nor a later phrasing shift
  points at anyone. The tap is a *community signal plus a nudge*, never a
  within-circle veto. Warmth in tone, honesty in content — the
  irony-of-harmony failure (commonality-focused positivity demobilizing
  grievance) is a named antipattern with a named guard: the differ-block
  is mandatory in every summary whenever the room's **public** reactions
  compute a disagreement (P7).
  **Residual:** a genuinely dissenting lone voice who taps *privately*
  does not shift their own small circle's summary — that within-circle
  silence is the deliberate cost of not outing them; if they want their
  dissent to move the room, the public "I see it differently" reaction is
  always one tap away and always visible. Named, accepted.
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
diversity constraints can be vacuously satisfied — the starter-circle path
(§2) exists so the seam never claims diversity there. The §2 guarantees
(floor 4, the pairs rule, singleton-cluster folding, relational
continuity) are the build-time answer, fixture-pinned (07 §5); what
remains unvalidated is the *procedure's effect*, not its arithmetic. See
08-critique C-v2-4.

## 7. Self-governance (Ostrom-shaped, deferred-but-designed)

Each community writes and adjusts its own house rules (collective choice);
sanctions are graduated and restorative (the notetaker de-escalates first;
stewards act second; removal is a two-steward action per v1 §4.4);
conflict resolution is cheap and fast (a named path, not a courtroom); and
the right to self-organize — fork, federate, leave with the data — is
constitutionally guaranteed by the substrate (design/02 §6, design/04 §4).
v2 adds no new governance machinery; it inherits v1's and gives it warmer
clothes. Build phasing: V4 (07 §3).
