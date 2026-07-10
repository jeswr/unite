<!-- AUTHORED-BY Claude Fable 5 (PSS design agent) -->

# 05 — Experts on tap, and the bridge from talk to action

The brief's goal (c): bring in EXPERTS — and the honest verb, everywhere
in this design, is **inform**, never execute. In scope C the system never
executes anything (§6; design/06 C8), so the brief's "help implement" is
served the only way it honestly can be: experts *inform* the room's
understanding and its options, humans self-select into action teams (§3),
and fate-trails carry the consequences back (§4). The failure modes on
both sides are documented: experts-on-top
re-stratifies the room around credentialed speech and converts the
community from author to audience (Sanders 1997; Young 2000; Fiske &
Dupree 2014 — competent-but-cold reads as untrustworthy); expert-free
populism strands the community without real knowledge. The narrow path is
the honest-broker / cross-examined-witness pattern (Pielke; Fishkin's
deliberative-polling protocol: experts answer the room's questions, they
don't open the room). And downstream of the experts, the deliberation
literature's most neglected lever: **efficacy receipts** — a platform that
is all sensemaking and no consequences trains its users that talking here
changes nothing (SIMCA's efficacy leg; Decide Madrid's proposal graveyard;
the OECD 2020 follow-through findings).

## 1. Experts enter late, downstream of the map, summoned by questions

- **The question-inbox.** The machine layer maintains an invisible inbox of
  question-shaped needs per community: recurring "has anyone done this?" /
  "what would it cost?" / "is that even legal?" turns detected by a
  deterministic heuristic (`lib/questions.ts`, 07 §4 — interrogative-form +
  recurrence floor ≥k, no ML in v2's demo), refined by the notetaker
  *asking* ("that sounds like a question for someone who's built one —
  want me to note it for when we find them?"). The conversation is the
  request form; no one ever fills in an expert-consultation ticket
  (the science-shop inversion: experts matched to questions, not embedded
  in communities).
- **Matching prefers practitioners** — the person who has *run* a community
  kitchen over the person who has published about them — recorded as a
  matching-policy default the stewards can see and change.
- **Timing rule (structural, not policy):** the expert affordance does not
  exist for a circle until its map has a stable question (the same
  stability heuristic as the draft-statement beat, 03 §5). Experts never
  open topics, never rank, never vote — those affordances are simply absent
  from the expert role's surface (v1's role machinery already scopes
  capabilities per credential; the expert role gets reply-in-thread and
  nothing else). vTaiwan's sequence, made unrepresentable rather than
  merely conventional.

## 2. How an expert appears (the whole trust stack, worn as an introduction)

> **unite** · notetaker
> You asked what a raised crossing actually costs. The stewards invited
> **Maria** — she's spent eight years building exactly these for two
> councils. `verified — municipal traffic engineering ✓`
> She'll answer in this thread, in plain words. Ask her anything — "ask
> Maria why" works on anything she says.

- The chip is `@jeswr/federation-trust` verification rendered small
  (v1 `lib/trust.ts`, fail-closed; the credential is checkable via the
  seam). The trust artifact the user experiences is social — *the group
  invited someone who builds this stuff* — with cryptography as its quiet
  floor, not its face.
- **Who issued that chip (the supply-side honesty).** "verified —
  municipal traffic engineering ✓" is only as strong as its issuer, and
  **no general expertise-credential authority exists** for the chip to
  lean on — a steward cannot competently attest engineering expertise,
  and the design refuses to fake authority with an unbacked checkmark. So
  the chip renders exactly the strength of what was actually verified,
  in two honest tiers: **steward-invited** — rendered as *"invited by
  your stewards · 8 years building these for two councils — her account,
  her name behind it"* (a social vouch plus the expert's own name-backed
  self-description; most pilot and all demo experts are this tier); and
  **institution-attested** — a `federation-trust` credential from a named
  employer or professional body where one participates in the trust web,
  with the ✓'s seam naming its issuer (*"attested by Anytown Council —
  checkable"*). A ✓ never renders stronger than its issuer. Building a
  credible, decentralized expertise-issuance ecosystem (professional
  bodies, employers, prior deliberation hosts as issuers) is an
  **explicitly open problem this design does not solve** — it is one of
  the pitch's named recruiting asks (06 §6.3).
- **Why an expert shows up at all** (named, not assumed): the format
  minimizes their cost — one bounded question, the consented synthesis
  attached, no forum to monitor; reply-in-thread and done — and the ask
  arrives as a personal, steward-signed invitation. The
  deliberative-polling and science-shop traditions run on exactly this
  economy and do get practitioners in the room. Whether that supply
  sustains beyond invited pilots is **unproven**; the demo stages Maria
  as a persona and says so (06 §2).
- **Contribution grammar: options-with-trade-offs** (the honest broker):
  "there are three ways councils usually do this; the cheap one floods in
  winter" — never "you should". Each statement is attributable and
  one-tap questionable. First-person, acknowledging the community's
  framing, in-thread (warmth signals are load-bearing: competence without
  warmth is distrusted).
- **What experts see:** the circle's *question and consented synthesis*
  (with dissent and provenance attached — the provenance door), never raw
  chat logs. No expert-resident surveillance relationship is constructible
  from the surface (P12; the consent moment is 02 §7's).
- **Equal status preserved:** experts are guests with a role chip, not
  members with status; their words rank in summaries by the same bridging
  math as everyone else's (a resonant expert answer earns its place the
  way any statement does).

## 3. From understanding to action (sequenced, never simultaneous)

The Mutz paradox is a design constraint: cross-cutting exposure and
mobilization trade off — a room asked to bridge *and* mobilize does
neither. So v2 sequences:

1. **Mixed circles do understanding and agenda-formation** (04). Their
   outputs: shared pictures, genuine-difference maps, questions, answered
   questions.
2. **Action teams self-select out of them.** When the engine detects
   readiness — recurring "someone should…", offers of skill/time, a
   converging cluster on a doable satisfier — it nudges **2–4 specific
   people, privately**, toward one small, time-boxed, together-step:
   > You three keep coming back to the corner garden. Fancy walking the
   > site Saturday — just to look?
   Never a broadcast CTA, never a petition button, never public pledge
   counts (Han's organizing-not-mobilizing; Kristofferson et al. 2014 on
   token-support licensing; Ganz's self/us/now supplies the ask's tone).
   The willing aren't diluted; the ambivalent aren't dragged.
   **This nudge is the most persuasion-shaped move the engine makes** —
   machine-initiated, private, aimed at real-world action — so it carries
   the strongest seam in the system, not the weakest (P5; the 03 §6 row):
   a **"why me?"** tap opens the literal evidence — the recurring turns
   and the offers of time/skill that matched, each one linked — plus
   three standing promises stated in the nudge itself: *only the named
   recipients see it; it is sent at most once per theme per person; and
   declining (or ignoring it) is sticky and consequence-free* — no
   re-asks, no "are you sure", nothing rendered to anyone else.
   Readiness detection is deterministic and inspectable
   (`lib/readiness.ts`, 07 §4): a lexical scan in the `sensitive.ts` /
   `questions.ts` mold — recurrence of first-person offer/ownership turns
   ("someone should…", "I could…", named skills, offered time) over a
   converging theme; no ML anywhere in it.
3. **Momentum is harvested within days** (the mutual-aid conversion
   window): the moment a team forms, the notetaker scaffolds exactly three
   things as hospitality — one shared next step, "who's bringing what"
   (informal roles), a check-in date. No charter, no registration ceremony
   (ceremony-first is a dead group; structurelessness-forever is Freeman's
   trap — minimal structure, delivered when it's needed, is the line
   between them). A default consent-based decision protocol + escalation
   path ships with every team, ignorable until a real conflict arrives
   (Ostrom).
4. **The day-after templates exist before they're needed:** where money or
   sustained effort enters, pre-designed patterns (fiscal host, co-op,
   mutual-aid roster, OSS-style repo with a maintainer core) surface only
   at the moment of need — the ConstitutionDAO lesson (euphoria with no
   day-after design).

## 4. Fate-trails (the anti-graveyard machinery)

Every graduated idea gets an auto-maintained **life-story thread**
(`#/story/<id>`), which is Decidim's accountability component recast as
narrative over the suite's existing `wf:Tracker`/task-model machinery
(v1's build-channel plumbing, re-skinned):

> **The Maple crossing** — started as a chat in the Mornings circle →
> 14 people shaped it → Maria weighed in (two options costed) → asked the
> council (Cllr Osei carrying it) → answered: yes to paint, not yet to the
> raised table (their words, linked) → the paint happened (photo) →
> checking back in March.

- **States in plain words**: dreaming / taking shape / asked / answered /
  being built / alive / **resting** — resting is an honest park with a
  stated reason, never a silent dead end (P3; the graveyard is the
  trust-killer — Decide Madrid).
- **Commitment-before-conversation:** when a conversation is action-bound,
  the listener is named up front as a small warm banner — *"The parks team
  is listening; they'll answer whatever comes out of this by June."*
  Dreaming-rooms and shaping-rooms are visually distinct so talk is never
  mistaken for a promise (the CCC "sans filtre" lesson: a broken maximal
  promise breeds more cynicism than a modest honest one).
- **Return loops are mechanical, not virtuous:** the system schedules
  "shall we look in on this?" at ~30/90/365 days, re-inviting the original
  circle (Ostbelgien's institutionalized follow-through). Unanswered asks
  escalate gently and honestly: *"we asked twice; here's what we can do
  ourselves"*.
- **Honest ignoring:** when power says no — or nothing — the thread says
  so plainly and warmly, then offers the community its own routes (do it
  ourselves / escalate / rest it). Visible cherry-picking converts
  betrayal into informed strategy (Font et al. 2018); silence is what
  kills trust.
- **Inside champions are tracked, visible roles:** each institution-bound
  theme names its carrier; champion departure triggers a handover flow
  instead of silent pipeline death (vTaiwan's stall).
- **Two-track delivery:** the engine splits any shared vision into
  community-deliverable pieces (2–6 weeks — celebrated loudly and fast)
  and institutional asks (months–years — milestone-granularity progress,
  never binary "we won!" then silence). Small wins first (Weick).
- **Voices travel, not dashboards:** the deliverable to councils/funders is
  a curated, consent-gated set of human moments — quotes, short arcs —
  with the bridging analysis as an appendix for staff (Cortico's proven
  artifact; every quote passes its ODRL gate). The upward flow always
  returns something visible to the people who talked (anti-extraction:
  Arnstein).
- **The read path (and the `buildLayer: false` line):** story threads are
  `wf:Tracker`/`wf:Task` **reads** via a thin new `lib/story.ts` (07 §4)
  — the channel-aggregator's fold pattern pointed at dedicated
  `stories/` pod containers, NOT the build layer's `build/threads` /
  `build/messages` dirs. Scope C's `buildLayer: false`
  (`scope/scopes.ts`) stands exactly as is: it gates the *agentic
  build/commission surface* (the build view, commissioning, delegation),
  none of which v2 adds to scope C. Reading a tracker into a narrative is
  scope-blind and executes nothing — `#/story/<id>` neither bypasses the
  gate nor needs it.

## 5. The personal payoff (quiet, true, unquantified)

Participant transformation is the most reliably delivered outcome in the
entire literature (Climate Assembly UK's 88–90% confidence/connection
gains), so v2 shows each person — privately, in the notebook, occasionally
— what they gained: people they found common ground with, questions they
helped get answered, things they helped make real. Specific, human, quiet
recognition; never points, never a public profile of civic virtue.

## 6. Scope-C boundary carried forward

Nothing in this doc changes v1's constitutional line: in scope C **the
system never executes** — publication and the fate-trail's narration ARE
the output; institutions and humans decide (design/06 C8). Action teams
are humans choosing to act, documented; the agentic build layer stays
A/B-only (`buildLayer: false` stands). The v2 addition is that the
*narrative* of consequence is now a first-class surface, because efficacy
made visible is what sustains the participation everything else depends on.
