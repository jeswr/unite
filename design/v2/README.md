<!-- AUTHORED-BY Claude Fable 5 (PSS design agent) -->

# unite v2 — the conversation is the interface

**Status:** design (2026-07-10), authored by the PSS design agent (Claude
Fable 5) from the maintainer's v2 brief. This is a **design for a
vision-selling prototype** — a working demonstration persuasive enough to
recruit a real team — not a production system and never described as one.
It extends the founding design (`design/01…06`), the platform plan
(`docs/PLATFORM-PLAN.md`), and the scope differentiation
(`docs/SCOPE-DIFFERENTIATION.md`); it redesigns the **surface and the
sensemaking**, and deliberately nothing underneath.

## The one-paragraph thesis

v1 is honest machinery wearing the machinery on the outside: *join a
deliberation, submit a Max-Neef-classified need, express tri-state resonance,
watch the bridging rank, ratify in the Convergence Room.* Every one of those
ceremonies is load-bearing — and every one of them is a participation filter
that admits only people who enjoy instruments. v2 keeps the machine and
changes what touching it feels like: **people chat about what they want the
world to look like**, in small warm circles, with a clearly-introduced
notetaker that listens, mirrors, and summarizes — while the *same* engine
(`app/src/lib`: resonance matrix → deterministic PCA + k-means → Laplace-
smoothed bridging scores → computed room outcomes) runs under the hood,
disclosed once, plainly, at the door, and inspectable on demand from every
single thing it produces. Hidden like plumbing, never hidden like a hand on
the scale.

## What v2 is NOT

- **Not a new engine.** The v2 engine is `app/src/lib` as it exists today.
  No new math beyond small deterministic pure modules composed over it
  (mirror drafting, circle composition, digest assembly, question/readiness
  detection, story reads — no ML in any of them). See
  [03-hidden-engine.md](03-hidden-engine.md).
- **Not a replacement for v1's surface.** The v1 views stay intact and
  routable; v2 mounts beside them from the same build so the two can be
  compared side-by-side on one deploy (that comparison *is* part of the
  pitch). See [07-build-plan.md](07-build-plan.md).
- **Not covert.** Every research thread this design rests on converges on
  the same line: gentle ≠ hidden-from-you. v2's disclosure posture is
  ambient-and-honest — one warm handshake at entry, a why-seam on every
  machine-made object, a full "how unite listens" page, and the user's own
  pod as the inspectable record. The design must pass the **reveal test**:
  a complete public explanation of the machinery should make users feel
  *respected*, not tricked (Loewenstein et al. 2015; Eslami et al., CHI
  2015). See [01-framing.md](01-framing.md).
- **Not gamified, not engagement-ranked, not growth-hacked.** No points,
  streaks, badges, leaderboards, live tallies, trending, or re-engagement
  notifications — each is individually ruled out by cited evidence, and
  collectively they are the thing unite exists to be the alternative to.

## The documents

Read in order — each builds on the previous:

| Doc | Contents |
|---|---|
| [01-framing.md](01-framing.md) | Positioning: why the surface must change, what the warm surface owes the honest machinery, the reveal test, and what v2 keeps from v1 invariant-by-invariant |
| [02-experience.md](02-experience.md) | The chat-first UX: surfaces, flows, and concrete copy — onboarding, the circle, the mirror, reaction gestures, the notebook, the commons digest, the garden |
| [03-hidden-engine.md](03-hidden-engine.md) | The hidden-algorithm mapping: every conversational move → the exact `app/src/lib` call it feeds; when and how inference is surfaced; legibility + contestability mechanics |
| [04-circles.md](04-circles.md) | Diverse-community formation: circle composition over the bridging engine, contact conditions as defaults, norm seeding, airtime equity, the engagement ladder |
| [05-experts-and-action.md](05-experts-and-action.md) | Experts on tap and the talk→action bridge: question routing, commitment banners, fate-trails, return loops, honest ignoring |
| [06-vision-demo.md](06-vision-demo.md) | The narrative arc a visitor experiences: the seeded demo journey, the behind-the-curtain reveal, and what the pitch asks for |
| [07-build-plan.md](07-build-plan.md) | The concrete build plan: surface seam, phases V0–V5, module inventory, the same-app decision and its justification, deploy topology |
| [08-critique.md](08-critique.md) | Adversarial self-critique — the attacks on v2 itself, kept per the house dissent-is-data rule |

## Relationship to v1's design documents

The founding design remains normative for everything it specifies: the
`fut:` data model and ODRL consent layer (design/01), the federation
architecture (design/02), the convergence mechanism and its guardrails
(design/03), governance (design/04), and the critique register (design/06).
v2 adds a **presentation covenant** on top (01-framing §4) and re-skins the
elicitation grammar; where a v1 surface rule and a v2 surface rule conflict
(exactly one place: *when* distributions are shown — see 03-hidden-engine
§5), the conflict is named and resolved explicitly rather than silently.

## Honesty ledger (what is grounded vs. speculative)

Grounded: every mechanism cited to the deliberation/psychology/HCI
literature in these docs names its source, and the engine behaviors cited
to code name the module (`lib/ranking.ts`, `lib/projection.ts`,
`lib/deck.ts`, `lib/gallery.ts`, `lib/convergence.ts` — all landed, tested,
deterministic). Speculative and flagged as such: conversational elicitation
producing resonance-matrix data of comparable quality to v1's explicit deck
(08-critique C-v2-3); the deterministic demo scribe standing in for a live
LLM (06 §4); circle composition at demo scale (04 §6). Also honestly
named, not finessed: the regulatory posture (01 §7 — GDPR Art. 9 explicit
consent + a DPIA are unmet prerequisites for any real deployment, and the
pod architecture does not remove them); "diverse" means cross-opinion-
cluster only, with demographic diversity a recruitment-side human
responsibility (04 §2; 08 C-v2-10); and the expertise-credential issuer
problem is open (05 §2). No throughput, latency, or engagement numbers
appear anywhere in these docs because none have been measured.
