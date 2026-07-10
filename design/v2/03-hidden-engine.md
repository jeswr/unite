<!-- AUTHORED-BY Claude Fable 5 (PSS design agent) -->

# 03 — The hidden-algorithm mapping: conversation in, engine unchanged, legibility out

This is the doc a builder needs open in a split pane. It specifies (1) how
every conversational move feeds the existing `app/src/lib` engine, (2) when
and how the system surfaces what it inferred, and (3) the legibility +
contestability mechanics that keep "hidden" meaning *unobtrusive* rather
than *covert*. The engine itself does not change — that is a design
constraint, not an observation (07 §1 makes it a build rule: v2 lands no
edits inside `lib/` math modules).

## 1. The engine, as v2 consumes it (inventory)

| Module | What it does (today, tested, deterministic) | v2 consumer |
|---|---|---|
| `lib/model.ts`, `lib/model-society.ts` | typed `fut:` round-trip; the adoption invariant unrepresentable (serializer throws, parser drops, aggregation gates) | every write the mirror produces |
| `lib/pod.ts`, `lib/pod-society.ts` | scope-guarded pod writes; sensitive-domain lexical screen (C4) fail-closed on every scope-C write chokepoint | chat utterances + adopted atoms |
| `lib/aggregate.ts` | fail-isolated, creator-verified, consent-gated (ODRL `fut:synthesize`) collection + dedupe | circle + community reads |
| `lib/ranking.ts` | `buildMatrix` (explicit universe; hostile votes ignored) → `cluster` (deterministic farthest-first k-means) → `bridgingScore`/`rankNeeds` (Laplace-smoothed product over clusters, distribution always returned) | summaries, letter, garden, circle composition |
| `lib/projection.ts` | deterministic PCA (fixed-start power iteration) → 2-D opinion points | the garden; notebook "where you sit" |
| `lib/deck.ts` | `routeDeck`: own-cluster-unseen-first, neighbour-resonance-next, exposure-spreading, total tie-breaks | "here's how someone across town put it" beats |
| `lib/gallery.ts` | `routeGallery`: contact-prior (cross-cluster author + shared need concepts led with) | story introductions between circles |
| `lib/insights.ts` | `characterizeReception` verdicts — `"common-ground"` / `"divisive"` / `null`; the third value is literally `null` (thin, lukewarm, or one-sided data). v2 copy renders `null` as **"still forming"**, and its seam says the honest reason (not enough said yet — never "forming toward agreement") | summary + letter phrasing |
| `lib/convergence.ts` | `candidateReception`: endorsed / disagreement / open, COMPUTED from votes, never asserted | the letter's draft-statement loop |
| `lib/dissent.ts`, `lib/shared-future.ts`, `lib/quorum.ts` | dissent annex materialization; un-signable-if-it-drops-dissent signing; steward quorum | the letter → Published futures pipeline (unchanged) |
| `lib/decompose.ts` (the `DecompositionAssistant` seam) | the adopt/edit/discard contract + PROV `fut:decomposedBy` typing. NB its shipped reference impl, `MANUAL_DECOMPOSITION`, **proposes nothing** — `decompose()` returns `{atoms: []}` (v1's manual-first path). It is the seam, not a drafter | the seam the mirror's drafter plugs into |
| `lib/mirror-draft.ts` — **NEW, V1** | the deterministic utterance→atom drafter the mirror actually needs (§2): cue-lexicon claim selection + Max-Neef keyword coding + template mirror sentence; implements `DecompositionAssistant.decompose()`; returns provenance `{tool: "mirror-draft", plan: <lexicon version>}` so adopted atoms carry `fut:decomposedBy` (C6) | **the notetaker's mirror** |
| `lib/trust.ts`, `lib/membership.ts` | tiers, role credentials, fail-closed verification | expert chips (05), steward signing |
| `lib/sensitive.ts` | first-person health/finance disclosure screen (C4); `assertNotSensitive` throws fail-closed at the `pod-society` expression-layer chokepoints — unchanged | atom adoption + every aggregation-bound write; **NOT chat utterances** (the gate split, §2a) |
| `lib/consent.ts` | ODRL policy authoring/evaluation | the in-context consent moments (02 §7) |

## 2. Utterance → atoms (the mirror pipeline)

```
person's message (free text)
  │  written to their pod as a plain CIRCLE MESSAGE (chat model), sharing
  │  tier: circle — UNGATED (§2a: the C4 screen does not run on utterances)
  ▼
mirrorDraft.decompose(utterance)          [lib/mirror-draft.ts — NEW — via
  │                                        the lib/decompose DecompositionAssistant seam]
  │  → candidate atoms: fut:Claim (≤500 chars) + fut:Need (need-scheme
  │    concept) + fut:ValueStatement (value-scheme concept)
  │  → C4 pre-screen: a candidate that trips screenSensitiveDomain is
  │    re-drafted from non-tripping sentences or not offered (§2a)
  │  → PROV: fut:decomposedBy → prov:Activity + prov:hadPlan
  │    ({tool: "mirror-draft", plan: <lexicon version>}) — assistance is
  │    never invisible (C6)
  ▼
the MIRROR message (02 §4): the candidate restated in one warm sentence
  │
  ├─ "that's it"          → fut:adoptedBy = author → the atom is written to
  │                          the author's pod via pod-society (C4-gated,
  │                          fail-closed) → enters the deliberation
  ├─ "close — fix it"     → author edits text/emphasis → adopt (the edit is
  │                          recorded; the corrected pair is the seam's
  │                          highest-quality training/audit signal)
  └─ "not it" / ignored   → draft discarded; NOTHING enters the engine
```

**Naming note (a v1-code correction this doc previously got wrong):** the
seam method is `decompose()`, not `draft()`; and `lib/decompose.ts`'s
shipped reference implementation (`MANUAL_DECOMPOSITION`) intentionally
proposes *nothing* — it is v1's manual select-text path, the identity
element of the seam. The conversational mirror therefore needs a real
drafter, which did not exist and is specified here as a new module.

**The drafter: `lib/mirror-draft.ts` (new, pure, deterministic).** The
drafting strategy — good enough for the five-minute demo arc, honest about
its quality ceiling (08 C-v2-5):

1. **Segment.** Split the utterance into sentences (`.`/`!`/`?` +
   newlines), trim, drop empties.
2. **Select the claim.** Score each sentence against a small fixed cue
   lexicon — *want-cues* ("i want", "i wish", "i'd love", "should",
   "needs to", "it would be"), *gripe-cues* ("can't", "unsafe", "too
   fast", "scares", "terrifying", "never works"), *memory-cues*
   ("i remember", "used to", "back when") — highest score wins,
   earliest-sentence tie-break; trim to the ≤500-char `fut:Claim` cap.
   No cue hits and the utterance is short → the whole trimmed utterance;
   no cue hits and it is long → **no claim is drafted** and the notetaker
   asks instead of guessing ("what's the one line you'd put on the
   wall?") — a template must never bluff comprehension.
3. **Code the need.** A keyword→Max-Neef map (a fixture-pinned data
   table, not code): safe/crossing/traffic/danger → `protection`;
   say/asked/decide/council → `participation`; afford/housing/fares →
   `subsistence`; choose/on-my-own/independen- → `freedom`; ours/belong/
   neighbourhood → `identity`; etc. The top-scoring concept becomes the
   drafted `fut:Need`, and its matched words feed the mirror's plain
   phrasing ("sounds like it's about feeling safe"); no match →
   claim-only draft.
4. **Values are conservative.** A `fut:ValueStatement` is drafted only on
   explicit value-cues ("what matters is", "treat each other", "fair") —
   absent otherwise.
5. **C4 pre-screen.** Any candidate whose text trips
   `screenSensitiveDomain` is re-selected from non-tripping sentences;
   when none survives, no atom is drafted and the boundary beat runs
   (§2a; copy in 02 §4.1).
6. **Render the mirror.** One template — *"Hearing you: {claim,
   compressed} — {need phrase}. Close?"* — where compression strips
   leading connectives, lowercases, and caps clause length.
   Deterministic: same utterance, same mirror.

Estimated size: ~200 lines plus the lexicon table and its fixtures —
small–medium, in the `sensitive.ts`/`questions.ts` lexical-module mold.
**Fixture plan (the V1 gate):** the nine persona utterances plus a crafted
free-text set (cue-less, multi-sentence, sensitive-tripping, and
hostile-string inputs) each pin the exact expected `DraftAtom`s and the
rendered mirror sentence; one end-to-end fixture runs utterance → draft →
mirror → adopt → `model-society` write → aggregate and asserts the adopted
atom lands in the matrix — and that discard/ignore writes nothing.

Three properties carry over from v1 untouched and are load-bearing here:
**nothing is attributable without adoption** (the invariant is
unrepresentable in the model layer — a claim with `adoptedBy ≠ creator`
cannot be written, parsed, or aggregated); **the assistant is a seam, not a
vendor** (deterministic reference implementation ships and is what the demo
runs — 06 §4; an LLM implementation slots in per-community with its plan
PROV-recorded, preserving the C6 anti-monoculture posture); **statements
are data, never instructions** (the mediator/assistant seams mandate
instruction/data separation; hostile text in a message can become at most a
hostile *string* in an atom).

The Max-Neef coding (the machine layer's job in the T3C/Sensemaker mold)
rides inside the drafted `fut:Need`: the assistant proposes the concept;
the mirror renders it as plain talk ("sounds like it's about feeling safe
and having a say"); adoption confirms it. The person never sees a taxonomy;
the engine always gets scheme-coded needs — better data than self-
categorization on both axes (accuracy and honesty of the act).

## 2a. The C4 boundary: where the sensitive screen runs (the gate split)

v1 runs `assertNotSensitive` (fail-closed, throws) at the `pod-society`
expression-layer write chokepoints — correct there, because everything v1
writes through them is deliberation input. An earlier draft of this doc
extended the screen to "every v2 free-text write," and that is wrong in a
chat: the screen's term list includes "my disability", "my anxiety", "my
benefits claim" — the ordinary vocabulary of a person explaining their own
stake. *"My disability makes this crossing terrifying"* is one of the demo
personas' most important sentences; a gate that refuses it vetoes the warm
chat itself and contradicts both P3 and 02 §3's "never moderated away".

**The split (a surface-boundary rule, not a relaxation of C4):**

- **Utterances are ungated.** A circle message is the person's own speech
  in their own pod, shared with a handful of people they are talking to —
  interpersonal disclosure they chose, like speech, not machine
  aggregation. It never enters the matrix, the summaries, or any derived
  artifact as-is, so the C4 rationale (health/finance-grade data must not
  enter aggregation until privacy-preserving machinery exists) does not
  bite on it. No `assertNotSensitive`, no analysis-refusal, no spinner.
- **The machine layer keeps the gate, unchanged and fail-closed.** Every
  path by which content can enter a shared/aggregated surface is
  C4-screened: the drafter pre-screens candidate atoms (§2 step 5), and
  the adoption write goes through the existing `pod-society` chokepoints,
  where `assertNotSensitive` still throws — a UI bypass still cannot
  write a sensitive-tripping atom. The consent moments (02 §7) sit
  downstream of adoption, so nothing screened can leak via quoting
  either.
- **The refusal is a conversational beat, not an error.** At the adoption
  moment the notetaker names the boundary, offers the civic reformulation
  it *can* carry, and offers keep-it-local as a first-class choice —
  copy and rules in 02 §4.1.

Honest residuals, stated: (1) circle-mates still see the disclosure — that
is the person speaking to their small room, which no data-protection gate
should silence; (2) the raw utterance in the pod is still personal data —
the GDPR posture (01 §7) applies to it regardless of this gate; (3) the
lexical screen remains what it always was — a conservative catch of the
obvious cases, not a classifier (its own header says so).

## 3. Gesture → resonance matrix (the vote that doesn't look like one)

Every reaction gesture writes an ordinary `fut:Resonance` to the reactor's
pod — `resonates` → `fut:Resonates`, `I see it differently` →
`fut:Conflicts`, `not sure` → `fut:Unsure`; the optional qualifier chips map
to the v1 dimension triple (`IShareThis`/`IAspireToThis`/`IWouldSupportThis`).
Wire format, dedupe (latest-wins per person×statement), creator
verification, and the explicit statement universe are all v1 behavior;
the label rendering is the only new thing.

**Peer-statement beats are the deck, dealt one card at a time.** When the
notetaker says *"a few people here have said X — does it ring true for
you?"*, X was chosen by `routeDeck` for this viewer: statements the
viewer's own cluster hasn't assessed, that neighbouring clusters resonated
with, exposure-spread over cold cards, deterministic tie-breaks. The
conversational costume changes nothing about the routing — and the routing
is why a first session can always offer a micro-outcome (02 §2 beat 4):
`routeDeck`'s neighbour-resonance ordering surfaces the nearest cross-
cluster echo for any viewer with ≥1 adopted atom, and its cold-start
fallback (least-seen-first) still yields a valid beat for a brand-new voice.

**Fresh atoms route to diverse readers same-session** (the Pol.is comment-
routing lesson; Community Notes' latency hole avoided): a newly adopted
claim enters circle-mates' next beats immediately — `routeDeck`'s
own-cluster-unseen-first ordering does this without modification, because a
new statement has `ownClusterSeen = 0` for *every* cluster.

**The letter's one-tap "resonates"** on a digest line is the same
`writeResonance` on the underlying statement — reading-as-participation
feeds the same matrix (P10).

## 4. Matrix → collective surfaces

- **Clusters** (`cluster`, k=2 today, k parameterized): consumed by circle
  composition (04 §2), deck routing, and the garden's beds. Never named
  ("cluster 1"), never labeled with politics; when a cluster must be
  referred to at all it is characterized by its *needs* ("people who weigh
  quiet streets and independence together"), computed from the cluster's
  top-resonance need concepts — above the k-threshold only (P11).
- **The living summary**: the circle's own statements pick *which* themes
  appear (what this room is talking about), but every verdict/phrasing is
  computed over the **community-scale** matrix: `rankNeeds` +
  `characterizeReception` run on all reactions the statement has received
  (every circle's deck beats + the letter's one-tap resonances), never on
  a circle-interior tally — the two-scale rule below.
  `characterizeReception` verdicts choose the phrasing —
  `common-ground` → "we're circling agreement on…", `divisive` → the
  mandatory "where we genuinely differ" block, `null` (the literal third
  value — thin/lukewarm/one-sided data) → **"still forming"**, whose seam
  gives the honest gloss ("not enough said yet", never implied momentum).
  The summary re-renders on aggregate read (same-session, the Remesh
  loop) — no overnight batch.
- **The garden**: `projectParticipants` gives the geometry (beds =
  clusters), `rankNeeds`' consensus set gives the bridges. Rendering rules
  (non-numeric, slow, no individual points, text equivalent) are 02 §6's;
  the data is v1's opinion map verbatim.
- **The letter**: assembled by a new thin module (`lib/digest.ts`, 07 §4)
  that *composes* existing outputs — ranked common ground + the dissent
  set + fate-trail deltas — into the four-part structure (02 §6). It
  contains no new judgment: every sentence is traceable to an engine output
  or a consented quote.

**The two-scale k rule (reconciling `DEFAULT_K_THRESHOLD = 5` with 4–6
person circles).** The engine's k (`lib/fut.ts`, k=5, unchanged) and the
circle size collide if applied naively: a 4-person circle can never clear
k, and a 5–6-person one only at near-unanimity — while P7's mandatory
differ-block *characterizes sub-groups*. Resolution, by context rather
than by weakening either rule:

- **Community scale — k applies in full.** Every ANONYMIZED
  characterization on a community-facing surface (letter themes, garden
  bridges, post-reaction distributions, why-sentence group references —
  anything phrased as "the group" rather than named-by-consent people)
  renders only above k. Below k: unattributed, fuzzed, count-free.
- **Circle scale — k inverts into "no anonymous stats at all."**
  k-anonymity is arithmetically unavailable inside a 4–6-person room, and
  fuzzing at n=5 would be theater. So circle-interior surfaces compute
  and render **no tallies, no splits, no anonymous characterizations**:
  summary lines are consented, attributed words; reception phrasing
  derives from community-scale distributions (above), so it is never a
  disguised circle headcount and a single circle-mate's reaction cannot
  be recovered from it.
- **The private "actually, I don't" tap (04 §4) cannot expose its
  presser.** The tap is community-scale input only: it writes an honest
  `fut:Conflicts` to the matrix and changes **no circle-visible state by
  itself**. The notetaker's missing-voice invitation ("what would someone
  who disagrees say?") is time-decoupled from any tap and also fires on a
  seeded, reproducible jitter when *no* tap occurred — so neither the
  prompt's arrival nor a later phrasing shift is evidence that anyone
  dissented, and a lone dissenter in a 4-person circle stays exactly as
  anonymous as their reaction on the community map (where k protects it).
- Fixture-pinned (07 §5): no circle-interior tally is computed anywhere
  in the surface modules; the dissent tap flips no circle-visible state.

## 5. The synthesis loop as a conversational rhythm (and the one v1 conflict)

The Habermas-Machine-shaped loop (design/03 §4) runs at the letter's
cadence instead of as a Room ceremony:

1. When a circle's map stabilizes (heuristic: the consensus set unchanged
   across two letters), the notetaker offers a **draft statement** in-flow:
   *"Here's a sentence I think most of this circle could stand behind:
   '…'. What did I get wrong?"*
2. Replies are the critique round — captured as `fut:Critique` (v1's S1
   class), stratified sampling across clusters for who gets asked first.
3. Revision is bounded (3 rounds, v1 default); every revision PROV-linked.
4. The "endorsement vote" is the same reaction row on the draft
   (`candidateReception` computes endorsed/disagreement/open from the
   votes — never asserted).
5. Endorsed → the v1 signing pipeline (steward quorum, mandatory dissent
   annex materialized from standing critiques, method-provenance label)
   → Published futures. Disagreement → the letter's differ-section leads
   with it, as the co-equal outcome it already is in v1.

**The one place v2 modifies a v1 surface rule.** v1: distributions are
*always* shown with any rank (design/03 §2, anti-false-polarization). v2:
distributions are shown **after the viewer's own reaction** (P4,
anti-herding — Muchnik 2013; Salganik 2006). Resolution: both, sequenced —
the distribution is unconditionally *available* and renders immediately
post-reaction and everywhere downstream (summaries, letter drill-downs,
instrument views), but never as a pre-reaction default. The perception-gap
correction survives (people still always see the real cross-cluster
distribution — after contributing their uncontaminated signal); the
recorded trade is that a non-reacting reader meets distributions only in
the letter/summary layer. Flagged for expert review alongside the v1
EXPERT-REVIEW checklist items.

## 6. The why-seam (legibility at the moment of use)

Every machine-made object carries exactly one quiet affordance: `why this? ›`.
The answers are **literal restatements of engine fields** — the
determinism makes them exact, not narrative:

| Object | Seam sentence (template) | Source fields |
|---|---|---|
| a peer-statement beat | "Because people in your part of the map haven't weighed in on this, and people who usually read the street differently found it rang true." | `DeckEntry.ownClusterSeen`, `.neighbourResonance` |
| a story introduction (gallery) | "Because Dana cares about some of the same things you do — {shared need concepts, humanized} — and sees the street from a different place on the map." | `GalleryEntry.sharedNeedConcepts`, `.acrossTheDivide` |
| a circle invitation | "This circle was put together to span the community's different ways of seeing this — you and {n} others were invited because together you cover it." (04 §2) | composition record |
| a summary line | "Said in different ways by {≥k} people across both parts of the map — tap to read the words it came from." (T3C drill-down, consent-gated) | `rankNeeds` distribution + provenance |
| a differ-block | "This circle holds two sincere readings of this — both shown in their own words; nobody's view was averaged away." (no headcounts at circle scale — §4's two-scale rule) | `candidateReception` verdict, community-scale |
| a draft statement | "Drafted by the notetaker from {n} adopted statements (every one linked); it has no standing until the circle's reactions clear the bar in every part of the map." | `prov:wasDerivedFrom`, room threshold |
| an expert introduction | "The circle's question matched her experience — who stands behind that chip is checkable (it names its issuer), and the invitation was a steward's." (05 §2) | trust.ts verification + question match |
| a private action-team nudge (05 §3) | "Only you three are seeing this. You're each being asked because you kept coming back to this and offered time or skill — {the turns, linked}. Saying no, or nothing, is a fine answer; this won't be asked twice." | `lib/readiness.ts` matched turns (recurrence + offer markers) |
| a receptiveness chip (02 §3) | "Offered because you're replying across a mapped divide. It's an opener, not your words — use it, edit it, or ignore it; nobody is told whether you did." | the reply-target's cluster vs. yours (P6) |

Second layer: every seam ends with *"the long version →"* linking the
matching section of **How unite listens** — the out-of-flow page carrying
the full mechanism write-up (plain-language algorithm description, the
open-source pointers, the audit trail, the aggregate data), the Community
Notes legitimacy move. In-flow stays one sentence (Kizilcec's inverted-U);
depth is always one deliberate tap away, never ambient.

## 7. Contestability (the notebook's mechanics)

The inferences live **in the person's pod and in recomputation — not in a
profile store**. Concretely:

- Adopted atoms and resonances are pod resources the person owns; the
  notebook (02 §8) lists them by reading the person's own pod — the same
  read path any circle aggregation uses. Nothing shown in the notebook is
  a copy of a server record, because there is no server record.
- **Edit** = write a superseding resource (latest-wins dedupe is already
  aggregate behavior). **Delete** = delete the pod resource; every
  downstream artifact is recomputed-on-read, so the next aggregate simply
  no longer contains it. Deletion propagation is architectural, not a
  compliance feature. The one honest residual is v1's: already-signed
  artifacts recorded consent as evaluated at synthesis time (the
  persist-after-deletion line in the consent copy — design/06 C4).
- Cluster membership and map position are **computed, ephemeral, and
  viewer-private**: they exist during a render (`cluster` /
  `projectParticipants` outputs) and are never written anywhere. "Where
  you sit" (notebook §4) recomputes live; contesting it = revising the
  reactions that produced it, which the notebook links directly.
- The k-threshold (P11) is enforced in the surface modules (digest,
  garden, seams) as a hard floor constant, fixture-tested: no ANONYMIZED
  group characterization below k renders on any community-facing surface,
  including in why-sentences — and circle-interior surfaces render no
  tallies at all (§4's two-scale rule; the stronger constraint at small
  n, because fuzzing a 5-person room is theater, not protection).

## 8. When the system surfaces what it inferred (the timing table)

| Moment | What surfaces | Register |
|---|---|---|
| entry (once) | that sensing exists at all; the pod promise | the handshake (02 §2) |
| per substantive turn (sparingly) | the drafted atom, for adoption/correction | the mirror (02 §4) |
| per reaction | the real distribution — *after* yours | inline, quiet |
| at USE (invitation, beat, expert pull-in, summary line) | the one-sentence why | the seam (§6) |
| monthly | the synthesis, the genuine differences, the fate-trails | the letter |
| on demand, always | everything about *you*; everything about the *mechanism* | notebook / How unite listens |
| never | live tallies, cluster labels on people, engagement stats, sub-k characterizations, per-message AI badges | — |

This table is the answer to "when/how does the system gently surface what
it inferred": at adoption time (correctable), at use time (explainable), at
rhythm (digestible), on demand (complete) — and never as ambient
instrumentation over people's words.
