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
| `lib/insights.ts` | `characterizeReception` verdicts (common-ground / divisive / open) | summary + letter phrasing |
| `lib/convergence.ts` | `candidateReception`: endorsed / disagreement / open, COMPUTED from votes, never asserted | the letter's draft-statement loop |
| `lib/dissent.ts`, `lib/shared-future.ts`, `lib/quorum.ts` | dissent annex materialization; un-signable-if-it-drops-dissent signing; steward quorum | the letter → Published futures pipeline (unchanged) |
| `lib/decompose.ts` + the `DecompositionAssistant` seam | narrative → candidate atoms; deterministic reference impl; PROV `fut:decomposedBy` | **the notetaker's mirror** |
| `lib/trust.ts`, `lib/membership.ts` | tiers, role credentials, fail-closed verification | expert chips (05), steward signing |
| `lib/sensitive.ts` | first-person health/finance disclosure screen | every v2 free-text write (chat is *more* exposed than v1's forms — the screen runs on utterances too) |
| `lib/consent.ts` | ODRL policy authoring/evaluation | the in-context consent moments (02 §7) |

## 2. Utterance → atoms (the mirror pipeline)

```
person's message (free text)
  │  written to their pod as narrative (fut:VisionStatement / fut:LifeContext
  │  or a plain circle message), sharing tier: circle    [lib/pod-society]
  ▼
DecompositionAssistant.draft(narrative)                   [lib/decompose seam]
  │  → candidate atoms: fut:Claim (≤500 chars) + fut:Need (need-scheme
  │    concept) + fut:ValueStatement (value-scheme concept)
  │  → PROV: fut:decomposedBy → prov:Activity + prov:hadPlan (model+prompt,
  │    or "deterministic-reference") — assistance is never invisible (C6)
  ▼
the MIRROR message (02 §4): the candidate restated in one warm sentence
  │
  ├─ "that's it"          → fut:adoptedBy = author → the atom is written to
  │                          the author's pod → enters the deliberation
  ├─ "close — fix it"     → author edits text/emphasis → adopt (the edit is
  │                          recorded; the corrected pair is the seam's
  │                          highest-quality training/audit signal)
  └─ "not it" / ignored   → draft discarded; NOTHING enters the engine
```

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
- **The living summary**: `rankNeeds` over the circle's universe picks the
  common-ground lines (group-informed consensus first); `characterizeReception`
  verdicts choose the phrasing — `common-ground` → "we're circling
  agreement on…", `divisive` → the mandatory "where we genuinely differ"
  block, `open` → "still forming". The summary re-renders on aggregate
  read (same-session, the Remesh loop) — no overnight batch.
- **The garden**: `projectParticipants` gives the geometry (beds =
  clusters), `rankNeeds`' consensus set gives the bridges. Rendering rules
  (non-numeric, slow, no individual points, text equivalent) are 02 §6's;
  the data is v1's opinion map verbatim.
- **The letter**: assembled by a new thin module (`lib/digest.ts`, 07 §4)
  that *composes* existing outputs — ranked common ground + the dissent
  set + fate-trail deltas — into the four-part structure (02 §6). It
  contains no new judgment: every sentence is traceable to an engine output
  or a consented quote.

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
| a differ-block | "About half the circle reads it one way, half the other — both leanings are shown in their own words; nobody's view was averaged away." | `candidateReception.perCluster` |
| a draft statement | "Drafted by the notetaker from {n} adopted statements (every one linked); it has no standing until the circle's reactions clear the bar in every part of the map." | `prov:wasDerivedFrom`, room threshold |
| an expert introduction | "The circle's question matched her verified experience — the credential is checkable, the invitation was a steward's." (05 §2) | trust.ts verification + question match |

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
  garden, seams) as a hard floor constant, fixture-tested: no group
  characterization below k renders, anywhere, including in why-sentences.

## 8. When the system surfaces what it inferred (the timing table)

| Moment | What surfaces | Register |
|---|---|---|
| entry (once) | that sensing exists at all; the pod promise | the handshake (02 §2) |
| per substantive turn (sparingly) | the drafted atom, for adoption/correction | the mirror (02 §4) |
| per reaction | the real distribution — *after* yours | inline, quiet |
| at USE (invitation, beat, expert pull-in, summary line) | the one-sentence why | the seam (§6) |
| weekly | the synthesis, the genuine differences, the fate-trails | the letter |
| on demand, always | everything about *you*; everything about the *mechanism* | notebook / How unite listens |
| never | live tallies, cluster labels on people, engagement stats, sub-k characterizations, per-message AI badges | — |

This table is the answer to "when/how does the system gently surface what
it inferred": at adoption time (correctable), at use time (explainable), at
rhythm (digestible), on demand (complete) — and never as ambient
instrumentation over people's words.
