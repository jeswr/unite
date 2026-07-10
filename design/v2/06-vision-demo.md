<!-- AUTHORED-BY Claude Fable 5 (PSS design agent) -->

# 06 — Selling the vision: the arc a visitor walks through

v2's deliverable is a **vision-selling prototype**: its job is to make a
researcher, an engineer, a funder, or a civic partner *feel* the product in
five minutes and then *verify* it in thirty — so a real team can be
recruited to build it properly. This doc scripts that arc. The demo rests
on the same seeded-sandbox machinery as v1 (an in-memory pod federation run
through the REAL pipeline, sandboxed to `demo.unite.example`, nothing
leaves the browser) — the demo is staged; the computation is not, and that
distinction is itself part of the pitch.

## 1. The audience and the ask

| Visitor | What must land | Where it lands |
|---|---|---|
| deliberative-democracy researcher | the literature is load-bearing, not decorative; the instrument is reviewable | the seams, How unite listens, the expert-review checklist |
| engineer | the engine is small, deterministic, tested; the surface is honest about what's real | behind-the-curtain, the repo |
| funder / civic partner | the felt warmth + the fate-trail; an economic story that isn't grant-cliff | the first five minutes; the roadmap page |
| skeptic / journalist | the reveal test passes; nothing discovered contradicts anything disclosed | everything, by design |

## 2. The staged neighbourhood ("Maple Street")

The demo community is a fictional neighbourhood circle, seeded with nine
personas (the v1 demo's two-cluster vote pattern, re-dressed): parents,
a shift worker, a wheelchair user, a shopkeeper, a retiree, a teenager —
spanning the two opinion clusters the engine will find, with genuinely
crafted disagreement (traffic calming vs. separation) and genuinely shared
needs (safe crossing, calm mornings). Every persona's statements are
written to demo pods and flow through the production aggregation, ranking,
clustering, and room machinery — the same "everything above the fetch is
real" posture as v1's demo, stated on the demo's first screen in one line:

> This is a staged neighbourhood with made-up people — but nothing about
> how it works is staged. Everything you'll see computed is computed for
> real, in your browser, from their words.

Honesty rule: personas are *visibly* fictional (illustrated avatars, a
"demo voice" tag on hover) — an undisclosed fake human anywhere in the demo
would fail the reveal test the whole design is built on. And the same rule
applied to the **demo's own mechanics**: the only scripted content is
persona-side (canned persona statements and their pre-written mirrors,
labeled as demo voice). Nothing on the visitor's own path is tuned to
manufacture a scripted feeling — the visitor's mirrors come from the same
un-tuned deterministic drafter the product ships (`lib/mirror-draft.ts`,
03 §2), which is checkable behind the curtain, where the drafter's lexicon
and the visitor's own draft trace are on display (§5).

## 3. The five-minute arc (the felt pass)

1. **Arrive** — the handshake message (02 §2). No signup. The visitor is
   offered a persona seat: *"Sit in as Sam — new to the street, hasn't
   said anything yet."*
2. **Speak** — the visitor answers the mornings prompt in their own words
   (or borrows a suggested memory to keep momentum — labeled *"borrow this
   memory"*, visibly a prop, never a hidden rail).
3. **Be heard** — the mirror lands ("Hearing you: … Close?"), drafted by
   the same **un-tuned** `mirror-draft` the product ships — NOT a version
   rigged to over-read so the correction beat performs on cue. (An
   earlier draft of this script choreographed exactly that, and it fails
   the reveal test this demo exists to pass: a recruit reading the seed
   code would find the "correction moment" was staged, and the felt
   repair would curdle retroactively.) A template drafter genuinely over-
   or under-reads often enough on its own; when it happens to land clean,
   the notetaker invites the visitor to stress it instead — *"that one
   landed. Try me on something harder — I'd rather show you the fix
   button than pretend I don't need one."* Either path exercises
   adopt-or-fix honestly.
4. **Feel the community** — the notetaker surfaces Rosa's resonant
   statement (routeDeck's nearest cross-cluster echo); the visitor reacts;
   the distribution appears *after* their tap; the living summary
   visibly gains their phrase (fate, within two minutes).
5. **Meet the difference warmly** — the differ-block: *"two sincere ways
   of seeing the traffic question — both in the group's words."* The
   visitor taps `why this? ›` and gets the seam sentence. This is the
   moment the design's character shows: disagreement rendered as the
   interesting part.
6. **See consequence** — the Maple-crossing fate-trail (05 §4), including
   the honest "not yet" from the council and Maria's costed options with
   her verified chip.
7. **The letter** — the month's digest, with its dissent section and the
   "bring someone who sees this differently" invitation.

Every beat exercises a covenant clause (P1 responsiveness, P3 fate, P4
elicit-first, P5 seam, P6 non-advocacy, P7 dissent-warmth) — the demo
script doubles as the covenant's acceptance walkthrough (07 §5).

## 4. The demo scribe is deterministic, and says so

The demo's mirrors are produced by `lib/mirror-draft.ts` — the
deterministic drafter behind the `DecompositionAssistant` seam (03 §2;
note the seam's *other* shipped implementation, `MANUAL_DECOMPOSITION`,
proposes nothing at all — it is v1's manual path, not a drafter) — plus a
small scripted overlay for the PERSONA seats only (canned high-quality
mirrors for the seeded statements, labeled as demo voice). Free-text
visitor input always goes through the real drafter, un-tuned (§3 beat 3),
with the *edit* path prominent — the correction affordance carries what
the template lacks in subtlety. The seam on any demo mirror says exactly
that: *"drafted by a deterministic
reference listener — a live community would choose its own helper, human
or model, and its choice would be recorded on every draft."* No live LLM
key ships in the demo; the LLM-backed assistant is a per-community seam
(C6 anti-monoculture, unchanged). This is flagged prominently rather than
finessed: the *quality ceiling of the deterministic mirror is a known
limitation of the demo, not of the design* (08-critique C-v2-3).

## 5. The behind-the-curtain reveal (the thirty-minute pass)

One tap from the demo chrome: **"See what was running the whole time."**
A split view replays the visitor's own session next to the engine state it
produced:

- their utterance → the drafted atoms → the adoption event (PROV chain
  rendered);
- their reactions → the resonance matrix row appearing;
- the map (the REAL v1 bridging view) with their dot placed — *"only you
  can see yours"*;
- the deck's routing table for their next beat (ownClusterSeen /
  neighbourResonance, the literal fields);
- the room's computed reception for the draft statement, dissent annex
  assembling;
- the pod inspector: every resource the session wrote, in their demo pod,
  deletable — with the summary recomputing live when they delete one.

This page is the pitch's centerpiece: **the reveal test performed as
theater**. Nothing on it should surprise a visitor who read the handshake —
that is the point, and the page says so: *"If anything on this page feels
like a betrayal of the conversation you just had, we've failed — tell us
which part."* The v1 instrument views (board/bridging/room) are linked
here as "the instruments, undressed", which is also where the v1↔v2
side-by-side comparison lives (07 §6).

## 6. The pitch page (what unite v2 asks the world for)

A short static page reachable from the demo (`#/join-us` on the demo
deploy), in the maintainer's voice, making the recruiting ask explicit:

1. **The claim**: engagement-ranked media divides by design; deliberation
   platforms that work are ceremonious minorities-of-enthusiasts; v2's bet
   is that the machinery of the second can wear the skin people actually
   inhabit — and that the only trustworthy way to do that is warm on the
   surface, auditable underneath, owned by you (pods, no server, open
   engine, seams everywhere).
2. **The evidence so far**: the working demo; the deterministic engine
   with its fixture set (B2's "independent implementation = passes the
   fixtures" carries over); the design docs with their literature and
   their kept self-critiques (06-critique + 08-critique — showing the
   scars is the credibility move).
3. **The asks, concretely**: (a) deliberation/psychology researchers to
   review the instrument (the expert-review checklist + the P-covenant
   walkthrough); (b) 2–3 engineers for the productionization the
   prototype defers (live LLM scribe behind the seam, real-time circle
   infrastructure, moderation tooling); (c) a pilot community partner
   (a neighbourhood org, a civic-tech group) for a curated cohort (04 §5)
   — who is also the actor that recruits *demographic* diversity the
   engine cannot see (04 §2); (d) an independent second implementation
   (the standing B2 criterion — unchanged); (e) funding honesty: the
   prototype implies no permanent philanthropy — the roadmap names
   sustainability as an open design problem rather than promising a cliff
   (Every One Every Day's lesson, named on the page); (f) a
   visual/interaction designer — the entire v1→v2 differentiation is a
   *felt* register, and copy alone cannot carry it (the 07 §3 V-D track);
   (g) privacy counsel for the pilot's DPIA and the explicit-consent
   entry flow (01 §7 — GDPR Art. 9 prerequisites the prototype does not
   clear); (h) partners for the expertise-credential issuance problem
   (05 §2 — who signs "municipal traffic engineering ✓" is an open
   problem, not a solved chip).
4. **The non-claims** (the no-overclaiming discipline): not production
   software; not a representative sample of anywhere; not "AI-mediated
   democracy" — opinion mapping plus mediated drafting plus human
   ratification, honestly named; and until B2/B5, "bootstrapping", never
   "decentralised".

## 7. The demo's own consent posture

Visitors' typed input in the demo stays in the browser (the sandboxed
in-memory pods) and evaporates on reload; the demo says so in the
handshake footnote (*"this demo forgets everything when you close it —
the real thing remembers only into your own pod"*). No analytics on the
demo beyond standard hosting logs; a feedback affordance (the suite's
standard FeedbackButton) is the only outbound channel, and it says where
the feedback goes.

Beyond the demo, the consent floor changes category: political-opinion
data is GDPR special-category, and any pilot with real people requires the
explicit recorded consent act and the DPIA named in the regulatory posture
(01 §7) — the demo's evaporating sandbox neither meets nor needs them, and
the pitch never implies the warm handshake alone would suffice for the
real thing.
