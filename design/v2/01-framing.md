<!-- AUTHORED-BY Claude Fable 5 (PSS design agent) -->

# 01 — Framing: warm surface, honest machinery

## 1. The diagnosis v2 answers

v1's surface makes its data collection the protagonist. A newcomer's first
five minutes contain: *join a deliberation*, *submit a need* (choosing a
Max-Neef fundamental-need concept from a picker), *tri-state resonance*
buttons, a *bridging-ranked* board, an *opinion map* of PCA clusters, a
*Convergence Room* with quorum chips and steward signatures. Every element
is defensible — most are literature-mandated — but together they present as
an instrument being administered, and the deliberation-platform literature
says exactly what happens next: participatory platforms with procedural
surfaces routinize into "technical, bureaucratic structures" and fail to
produce deliberation (the Decidim/Consul finding), the people who stay are
the enthusiasts who tolerate framework labor, and everyone else — the
diverse population the bridging math *needs* — bounces. Making humans
perform the taxonomy (pick your own Max-Neef bin) is unpaid framework labor
that LLM coding made obsolete (Talk to the City; Jigsaw Sensemaker). Survey-
style elicitation also produces *worse data* than conversation while killing
the meaning of the act (Kim, Lee & Gweon 2019).

Separately, v1 has no first-session payoff. The research on civic
motivation is unambiguous: people continue when they are **accurately
heard** (perceived responsiveness — understanding/validation/care), when
their contribution has a **visible fate**, and when a **felt micro-outcome**
lands early. v1 offers a rank on a board.

## 2. The v2 position, in three sentences

**unite v2 feels like chatting with a few thoughtful neighbours about what
you want the world to look like.** A plainly-introduced notetaker listens,
mirrors you back in your own words, and keeps a living picture of what the
group is figuring out together — and the consensus machinery that v1 wears
on the outside (opinion clustering, bridging ranking, synthesis with
mandatory dissent) runs underneath, feeding those same warm moves. **Nothing
the machinery does is secret; it is simply not in your face** — disclosed
once at the door, explainable from every artifact it touches, auditable in
full by anyone who cares to look.

## 3. Why "hidden but honest" is a stable position (and not a euphemism)

The tension in the brief — algorithms "invisible or gentle" vs. the entire
covert-manipulation literature — dissolves once *hidden from attention* is
separated from *hidden from inspection*:

- **Discovered-hidden curation destroys trust retroactively** (Eslami et
  al., CHI 2015: users who find hidden feed curation on their own build
  hostile folk theories; the Facebook emotional-contagion backlash;
  OkCupid). So v2 may never be *covert*: the sensing is disclosed at entry,
  in warm plain language, before it does anything.
- **In-flow procedural transparency lowers trust and re-creates the v1
  problem** (Kizilcec's inverted-U; O'Neill on transparency dumps; consent
  walls as fatigue theater — Nouwens et al., CHI 2020). So v2 may never be
  *wallpapered with explanations* either: no per-message AI badges (they
  measurably diminish feeling heard — Yin et al. 2024), no confidence
  scores bleeding into chat, no "analyzing…" spinners over people's words
  (visible surveillance cues chill expression — Enzle & Anderson 1993).
- The stable point between is **seamful design**: quiet by default, one
  honest handshake at entry, and a **seam on every machine-made object** —
  a one-tap "why am I seeing this?" that opens plain-language provenance at
  the moment of *use*, which is when the explanation is answerable (Chalmers;
  Ehsan et al.; the Community Notes legitimacy move of full out-of-flow
  documentation). Explanations arrive when an inference *does* something
  visible, not when data is captured.

v2 formalizes this as the **reveal test** (its single most load-bearing
rule): *for every mechanism, write the complete public explanation; if a
reasonable user reading it would feel tricked rather than respected, the
mechanism is redesigned — not the explanation.* Transparent nudges keep
working (Loewenstein et al. 2015; Bruns et al. 2018); concealed ones become
the story. The behind-the-curtain page (06 §5) exists so the reveal is a
*feature of the pitch*, not a risk to it.

Three structural facts make unite unusually able to occupy this position:

1. **There is no server doing the profiling.** The v1 architecture computes
   everything client-side from pod-hosted resources: cluster assignments,
   bridging scores, and room outcomes are *recomputed on read* from the
   participants' own pods (`lib/aggregate.ts` → `lib/ranking.ts`), never
   stored as server-side profiles. The "pod-washing" antipattern (raw chat
   in the pod, opinion vectors accumulating server-side) is structurally
   unavailable — there is nowhere for the shadow profile to live.
2. **The engine is deterministic and tiny.** Same votes, same map
   (`lib/projection.ts` fixed-start power iteration; `lib/ranking.ts`
   farthest-first k-means; characterization-fixture-tested). A why-seam over
   a deterministic engine can be *exact* — "you're seeing this because your
   group hasn't weighed in and two people who usually see things differently
   both resonated" is a literal restatement of `DeckEntry`'s fields
   (`ownClusterSeen`, `neighbourResonance`), not a plausible story about a
   black box.
3. **Everything attributable already requires explicit adoption.** v1's
   consent invariant (nothing enters deliberation attributed to a person
   without `fut:adoptedBy` — unrepresentable end-to-end, three independent
   layers) is *exactly* the mirror-check gesture v2's warmth needs
   (02 §4). The consent machinery and the feeling-heard machinery are the
   same machinery.

## 4. The presentation covenant (v2's additions to the v1 invariants)

v1's invariants all stand (mandatory dissent, computed-never-asserted
outcomes, distribution-with-every-rank, no engagement ranking anywhere,
consent-gated synthesis lineage, k-anonymity, stratify-and-disclose,
fail-closed trust). v2 adds a covenant about *presentation*, each clause
traceable to the research synthesis:

| # | Clause | Grounding |
|---|---|---|
| P1 | **Responsiveness before machinery.** The first-session loop is speak → be accurately mirrored → only then does anything algorithmic touch the words. | perceived responsiveness is the mechanism of feeling heard |
| P2 | **No survey controls anywhere on the v2 surface.** Needs/values/resonance are elicited conversationally; classification happens in the machine layer and is mirrored back gently and correctably. | Kim, Lee & Gweon 2019; T3C/Sensemaker LLM coding |
| P3 | **The anti-pseudo-voice invariant.** If the engine cannot use an input, the UI must not ask for it; every contribution gets a truthful fate-trail. | Folger 1977; de Vries et al. 2012; Arnstein |
| P4 | **Elicit before exposing.** No one sees the group's distribution/clusters/themes on a statement before voicing their own take. | Muchnik, Aral & Taylor 2013; Salganik 2006; Noelle-Neumann 1974 |
| P5 | **One honest handshake, then ambient.** Disclosure once at entry in two warm sentences; a seam on every machine-made object; the full write-up out of flow; no consent walls, no per-message badges. | Eslami 2015; Kizilcec; Yin et al. 2024; Nouwens 2020 |
| P6 | **The notetaker mirrors, asks, and summarizes; it never advocates, never opines, never rephrases anyone toward agreement.** Role-framed at introduction ("listens, summarizes, never decides"). | Jakesch et al. (latent persuasion); reactance literature; Luger & Sellen 2016 (role clarity survives NLU failure) |
| P7 | **Dissent is the interesting part.** Every synthesis ships "where we genuinely differ" with equal visual warmth; no metric, copy, or celebration rewards unanimity. | v1 design/03 §6 + Mouffe carried forward; Ovadya & Thorburn centrism-drift warning |
| P8 | **No numbers where a shape will do.** The collective state is slow, ambient, non-numeric (the garden/constellation); tallies never render live. | spiral of silence; early-vote herding |
| P9 | **Warmth attaches to people and the shared picture, never to the bot.** No simulated intimacy, no reciprocal self-disclosure by the notetaker, no typing-pause theater. | CASA over-disclosure; Ishowo-Oloko et al. 2019; Laestadius et al. 2022 |
| P10 | **Reading is participation.** The digest is a legitimate surface; one-tap resonance on a digest line is a real contribution; no guilt prompts, no activity metrics, no re-engagement pressure. | lurker legitimacy; Gerber/Green/Larimer backlash |
| P11 | **k-threshold on every group characterization**, everywhere one is surfaced (digest, garden, why-sentences): below minimum cluster size, themes stay unattributed and fuzzed. | Sweeney 2002; the small-group deanonymization antipattern |
| P12 | **Consent moves with context, as conversation.** Nothing asked at signup; the first time a contribution would flow beyond the circle, the ask happens in-context, specifically, and the answer is an ODRL policy in the author's pod. | Nissenbaum contextual integrity; Kaye et al. dynamic consent; v1's ODRL layer unchanged |

The covenant is testable: each clause becomes checklist items in the demo
walkthrough (06 §6) and fixtures where machine-checkable (07 §5).

## 5. Positioning against the field (what the pitch may honestly claim)

- **vs. Pol.is / vTaiwan:** unite v2 keeps the load-bearing Pol.is choices
  (atomic statements, no open replies at the aggregate layer, opinion
  mapping, ≤5-seconds-per-engagement) but replaces the ballot surface with
  conversation and adds a persistent community around the map. Honest
  naming: the aggregate layer is *opinion mapping*, not deliberation; the
  deliberation happens in the circles around it — the same honesty vTaiwan
  earned (Small et al. 2021).
- **vs. the Habermas Machine:** unite adopts the mediated-synthesis loop as
  a conversational move with critique as first-class input (Tessler et al.,
  Science 2024) but rejects synthesis-as-verdict: humans ratify, dissent is
  carried, and — unlike the Habermas Machine — participants actually talk
  to each other.
- **vs. Community Notes:** the same bridging objective everywhere content is
  ordered (Wojcik et al. 2022), with two deliberate improvements: fresh
  contributions route to diverse readers same-session (no 15-hour latency),
  and where bridging finds no consensus the *shape of the disagreement* is
  surfaced warmly instead of silence.
- **vs. Decidim/Consul:** no procedural surface, no proposal graveyard —
  nothing enters a pipeline without a listener, and every graduated idea has
  a narrated fate (05 §4).
- **vs. every commercial "AI facilitator":** the pod-native, no-server,
  deterministic-core architecture makes "warm on the surface, auditable
  underneath, owned by you" a checkable claim rather than PR — that is the
  differentiator the recruiting pitch leads with (06 §7).

## 6. Scope note

v2 as specified here targets **scope C (society)** first — the warm chat
surface over visions/needs/values is scope C's expression layer re-skinned,
and scope C is where the ceremony cost bites hardest (its floor is T0;
its participants are the general public). Scopes A/B keep the v1 surface
(their users are builders/implementers; the instrument idiom serves them).
The circle/commons machinery is scope-blind, so extending v2 to A/B later
is a configuration decision, not a redesign — see 07 §2.
