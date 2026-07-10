<!-- AUTHORED-BY Claude Fable 5 (PSS design agent) -->

# 07 — Build plan: one app, a second surface, the same engine

Specific enough for a builder agent to start V0 without further design.
Every phase lands through the standing gates (lint / typecheck / vitest /
build, roborev on every commit, adversarial verify where security-relevant)
and extends the conformance-fixture discipline with fixtures for whatever
it adds.

## 1. The standing constraints (build rules, not suggestions)

1. **The engine does not change.** No edits inside `lib/ranking.ts`,
   `lib/projection.ts`, `lib/deck.ts`, `lib/gallery.ts`, `lib/insights.ts`,
   `lib/convergence.ts`, `lib/aggregate.ts`, or the model layer's
   invariants. New needs are met by new pure modules that *compose* these.
   (If a genuine engine gap is found, it is a flagged follow-up with its
   own review — never a ride-along edit.)
2. **v1 stays byte-identical when the v2 surface is off.** Every phase's
   acceptance includes: the v1 routes render unchanged (snapshot-guarded)
   with `surface=v1` (the default).
3. **New copy honors the presentation covenant** (01 §4). The covenant's
   machine-checkable clauses become fixtures (§5); the rest are walkthrough
   items on the demo script (06 §3).
4. **All the house disciplines apply**: injectable `fetch` only,
   authenticated-fetch-for-own-pod / public-fetch-for-foreign (the
   credential-leak boundary), `assertWithinBase` on every write, no
   hand-built triples, `lib/sensitive.ts` on every free-text write path,
   AUTHORED-BY markers, roborev per commit.

## 2. The decision: a v2 surface directory in the SAME app (not a sibling app)

**Decision: `app/src/v2/` — a parallel UI surface in the existing SPA,
selected at runtime by a `surface` dimension exactly analogous to the
existing `scope` dimension; the v1 views and the engine are shared, not
forked.**

```
app/src/
  lib/        ← the engine (unchanged; shared by both surfaces)
  scope/      ← scopes (unchanged) + NEW surface.ts (resolveSurface)
  demo/       ← shared demo pods + NEW v2 persona/copy seeds
  ui/         ← the v1 surface (unchanged)
  v2/         ← the v2 surface: views, chat components, copy, seams
```

Resolution mirrors `resolveScope` (pure, fail-closed, tested): precedence
`?surface=` query → `VITE_UNITE_SURFACE` env pin → hostname first label
(`chat`, `v2`) → default `v1`. Routes namespace under the same hash router
(`#/commons`, `#/circle/<id>`, `#/notebook`, `#/how`, `#/story/<id>` added
to the view set, enabled only when the v2 surface is active — the same
fail-closed enabled-view guard the scope system already uses).

Justification (against the alternatives the brief names):

- **vs. a sibling app (new repo/package):** a sibling would consume the
  engine as a dependency — which today means path-copies or a git dep of
  an app-internal `lib/`, i.e. an immediate fork of the exact code v2
  exists to reuse, plus a second deploy pipeline, a second clientid
  document, a second demo-seed tree, and drift between v1 and v2's data
  layers the moment either moves. Extraction of `lib/` into a
  `@jeswr/unite-model` package is already a named v1 follow-up — *if that
  lands later*, the surface split can be revisited; doing it now couples
  the v2 surface work to a package-extraction project it doesn't need.
- **vs. `#/v2/*` routes with no surface dimension:** routes alone leave
  both surfaces mounted in one chrome — the v1 nav and the v2 commons
  would fight over the shell, and the "distinct URL" ask degrades to a
  fragment. A surface dimension gives each URL a coherent single-surface
  chrome while sharing the build.
- **Side-by-side comparison is a first-class requirement** (the maintainer
  wants v1 vs v2 comparable): one build artifact serving both surfaces
  means any deploy can show both — `?surface=v1` / `?surface=v2` on the
  same commit — and the behind-the-curtain page (06 §5) links the v1
  instrument views *in-place* (same session, same demo pods, same engine
  state). A sibling app could never share live state like this without
  inventing a sync layer.
- **Deploy to a distinct URL** falls out of the existing topology
  (PLATFORM-PLAN §3: one Vercel project, several domains, runtime
  resolution): add `chat.unite.jeswr.org` (or `v2.unite.jeswr.org` —
  final name is a needs:user domain pick) to the same project; the
  hostname selects the surface the way `apps./infra./society.` select
  scopes. Until DNS: `?surface=v2` on the existing deploy URL. The
  clientid document already carries the per-origin redirect discipline.
- **Surface × scope:** v2 initially binds to scope C (01 §6):
  `surface=v2` forces the society scope config; the surface record carries
  its own view set. The seam leaves A/B-on-v2 as configuration work later.

## 3. Phases

| Phase | Contents | Acceptance | Depends on |
|---|---|---|---|
| **V0 — surface seam** | `scope/surface.ts` (resolveSurface, tested like resolveScope); route additions (parse-only); an empty v2 shell ("under construction" honestly labeled); v1 snapshot guard | v1 byte-identical on default; all gates green | nothing |
| **V1 — the circle** | chat thread view over the demo pods (messages = pod resources, the v1 demo-fetch facade); the notetaker's handshake + prompts (static script engine: prompt sequencing, no LLM); **the mirror pipeline** — `DecompositionAssistant` reference impl wired to chat, mirror UI (adopt / fix / discard), adoption writing through `model-society` (invariant untouched); reaction rows → `writeResonance`; `lib/sensitive.ts` on the chat write path | a visitor can complete 02 §2 beats 0–3 in demo mode; fixtures: mirror→adopt→aggregate round-trip; discard writes nothing | V0 |
| **V2 — sensemaking surfaces** | the living summary (`rankNeeds` + `characterizeReception` composition); **`lib/digest.ts`** (the letter assembler — pure, fixture-tested: given aggregate outputs + consented quotes, emits the four-part structure with mandatory differ-section and k-threshold); the notebook (own-pod read + edit/delete propagation); why-seams on beats/summary lines/differ-blocks (03 §6 templates rendered from engine fields); elicit-before-expose gating (distribution renders post-reaction only); the garden (projection → non-numeric ambient view + text equivalent); How-unite-listens v1 (static + links to instrument views) | 02 §5/§6/§8 demonstrable; fixtures: digest k-threshold floor (no sub-k characterization renders), differ-block mandatory when reception is `divisive`, deletion recompute | V1 |
| **V3 — circles + composition** | **`lib/circles.ts`** (deterministic diverse-but-bridgeable partition over `cluster` + `needProfile`; exhaustively unit-tested incl. the vacuous-diversity guard from 04 §6); multi-circle demo; circle invitations with the composition seam; airtime-equity + hidden-profile prompts in the notetaker script (per 04 §4 — hidden metrics, conversational repair); the private "actually, I don't" tap | composition fixture (crafted matrix → exact expected circles); no surface anywhere renders talk-share stats | V2 |
| **V4 — experts + fate-trails** | **`lib/questions.ts`** (deterministic question-shaped detection, recurrence floor); the expert role surface (reply-only affordance over the existing `trust.ts` role machinery; the verified chip + introduction copy); consent moments (02 §7) writing ODRL terms via `lib/consent.ts`; fate-trail threads (`#/story/<id>`) over `wf:Tracker`/task-model with the plain-word state ladder incl. `resting` + reason; commitment banners; return-loop scheduling (demo: simulated clock) | 05 §2/§4 demonstrable end-to-end on the seeded Maple-crossing story; fixtures: expert affordance absent pre-stable-question; state ladder never renders a dead end without a reason | V2 (parallel with V3) |
| **V5 — the demo arc + pitch** | persona seats + the scripted five-minute arc (06 §3); the deterministic demo-scribe overlay (06 §4) with its honesty seam; **behind-the-curtain** (06 §5: session replay next to engine state, pod inspector with live-recompute-on-delete); the pitch page (06 §6); accessibility pass (02 §9 — screen-reader walkthrough recorded as a checklist in the repo); the letter's monthly-rhythm simulation | the full covenant walkthrough passes; a cold visitor can run the arc unaided | V3 + V4 |

Post-V5 (explicitly deferred, tracked, not designed here): a live LLM
`DecompositionAssistant` behind the seam (per-community, PROV-recorded);
real-time transport for circles (the demo is same-browser; live circles
need the notifications substrate v1 already uses); moderation/safety
tooling beyond `lib/sensitive.ts`; scope A/B on the v2 surface; pilot
cohort onboarding flows.

## 4. New module inventory (all pure, all deterministic, all fixture-tested)

| Module | Composes | Est. size |
|---|---|---|
| `scope/surface.ts` | (parallel to scopes.ts) | small |
| `lib/circles.ts` | `cluster`, `needProfile` | small–medium |
| `lib/digest.ts` | `rankNeeds`, `characterizeReception`, `candidateReception`, consent gates | medium |
| `lib/questions.ts` | aggregate text scan (lexical, like `sensitive.ts`) | small |
| `v2/script.ts` | notetaker prompt/beat sequencing (a state machine over deck/gallery/room outputs) | medium |
| `v2/seams.ts` | the 03 §6 sentence templates from engine fields | small |
| `v2/views/*` | Circle, Commons, Notebook, How, Story, Curtain | the bulk of the UI work |

No new dependencies are anticipated for V0–V4 (the chat UI is ordinary
React over the existing stack; the garden is SVG like the v1 map). Any
proposed dependency goes through `check-packages` per the house gate.

## 5. Fixtures + the covenant as tests

The machine-checkable covenant clauses become standing fixtures:

- **P3 fate-trail**: every adopted atom is reachable from at least one
  surface (summary, letter, or story) in the demo state — a graph check.
- **P4 elicit-first**: the distribution component renders null pre-reaction
  (component test).
- **P11 k-threshold**: digest/garden/seam snapshot tests over a crafted
  sub-k cluster.
- **Adoption invariant**: already covered in v1's suite; V1 adds the
  chat-path round-trip.
- **Determinism**: circles/digest/questions get characterization fixtures
  in the v1 style (crafted inputs → exact expected outputs), extending the
  set B2's "independent implementation = passes the fixtures" definition
  reads from.

## 6. Deploy + naming (needs:user items collected)

- Domain for the v2 surface (`chat.unite.jeswr.org` proposed) — DNS is a
  maintainer action; `?surface=v2` works from day one without it.
- The garden metaphor final pick (garden beds vs constellation) — a
  proceed-and-document call at V2 build time; default: constellation
  (renders better in dark mode and carries no growth≈progress implication
  the k-threshold would then have to fuzz).
- The demo scribe's canned-mirror copy set — written at V5 with the same
  register rules as 02.

## 7. What this plan does NOT build (honesty)

No live multi-user circles (demo is single-visitor + personas), no
production auth on the v2 surface beyond what v1 already wires, no LLM
calls anywhere in the shipped demo, no mobile app, no notification
delivery, no real expert marketplace — the prototype *stages* the expert
and fate-trail loops end-to-end on seeded data (the same honest-sandbox
posture as v1's demo). The pitch page says exactly this list out loud
(06 §6.4).
