<!-- AUTHORED-BY Claude Fable 5 (PSS design agent) -->

# 02 — The experience: surfaces, flows, and copy

Everything here is specified to be buildable: each surface names its data
source in the engine (cross-referenced to [03-hidden-engine.md](03-hidden-engine.md))
and the copy is concrete draft copy, not placeholder. Copy register: ~grade
6–8 plain language, warm, no exclamation marks, no civic-duty framing, no
"platform" talk. The notetaker speaks as a role, never as a friend (P6/P9).

## 1. Surface inventory

| Surface | What it is | Route | Engine source (03 §) |
|---|---|---|---|
| **The commons** (home) | a calm ambient view of the community — the garden/constellation, the current digest letter, your circles, one gentle prompt | `#/commons` | projection + rank + digest (03 §4, §6) |
| **A circle** | a small (4–6 person; 4 is the diversity floor — 04 §2) chat thread with the notetaker present; the entire deliberation surface | `#/circle/<id>` | matrix/cluster/deck/room (03 §3–5) |
| **Your notebook** | everything unite has heard *from you*, in plain language, each item editable/deletable | `#/notebook` | the user's own pod, read directly (03 §7) |
| **How unite listens** | the full out-of-flow explanation: what the helper does, the algorithms, the data, links to source + audits | `#/how` | static + live examples |
| **What came of it** | fate-trails: each graduated idea's life-story thread | `#/story/<id>` | task-model trackers (05 §4) |
| **Shared futures** | v1's Published-futures renderer with v2 copy (signed artifacts, dissent annex first-class) | `#/published-futures` (kept) | v1 pipeline unchanged |

Deliberately **absent**: any feed of strangers' content ranked for
engagement, any live tally or counter, notifications other than a person
addressing you or a fate-trail update you opted into, profile pages, karma,
streaks, points, follower counts. The v1 instrument views (board, bridging
map, room, deck) remain reachable — relocated behind `How unite listens →
"see the instruments"` — because hiding them would fail the reveal test;
they are simply no longer the path anyone is put on.

## 2. First run (the whole loop is one conversation)

**Beat 0 — arrival.** No signup wall. A visitor lands in a live demo circle
(06 §2) or, via an invitation link, in their inviter's community. The first
screen is a chat surface with one message waiting:

> **unite** · notetaker
> Welcome. This is a place where a few people at a time talk about what
> they want life around here to look like — and slowly build a shared
> picture of it.
>
> Before you say anything: I'm unite's notetaker, not a person. As people
> chat, I listen for what matters to them and where they agree more than
> they'd guess. Everything I learn about you stays in your own notebook —
> you can see it, fix it, or delete it anytime, and I'll show you exactly
> what I do with any of it before it goes further than this circle.
> *[How this works](#/how)* — the long version, if you want it.
>
> No forms, no right answers. Ready when you are.

That message is the **one honest handshake** (P5): machine identity
role-framed ("notetaker … not a person" — SB-1001-compliant, expectation-
lowering per Luger & Sellen), the sensing disclosed ("listen for what
matters … where you agree more than you'd guess"), the pod promise made
humanly, the deep explanation one tap away and *not* forced. There is no
consent modal; joining the conversation after this message is the
conversational-sensing grant (P12 — anything beyond the circle re-asks in
context, §7). **Real-deployment amendment (01 §7):** for a pilot with real
people, this handshake is followed by ONE explicit, recorded consent act
before the notetaker's listening begins — the GDPR Art. 9 floor for
political-opinion data. Designed as a single warm affirmative moment, not
a consent wall; the demo, whose input evaporates in-browser, has nothing
to ask.

**Beat 1 — the opening prompt** (aspirational and future-shaped, never
positional — the Bowling Green lesson):

> **unite** · notetaker
> Here's what this circle is chewing on: **what should mornings be like on
> this street in five years?** Someone said "I want to hear kids on bikes,
> not brakes." What comes to mind for you — a memory, a wish, a gripe?
> All three welcome.

Quick-reply chips under the composer (never chips-only — free text always
open, P-accessibility): `A memory` · `A wish` · `Honestly, a gripe`.

**Beat 2 — the person speaks.** Free text, any length. Voice input
supported. No timeout ever.

**Beat 3 — the mirror** (the load-bearing move — §4 below).

**Beat 4 — a felt micro-outcome.** Within the first session, at least one
of: another person's message that resonates with theirs is surfaced ("Rosa
said something close to this on Tuesday — want to see?"), their phrase
appears in the circle's living summary with attribution-by-consent, or a
standing question from the circle gets their contribution attached. The
system is designed so this always exists to offer (03 §3: the deck router
guarantees a nearest-neighbour statement); external efficacy is learned
from early consequences.

**Beat 5 — the exit.** No "complete your profile", no streak seeding. The
notetaker closes the session with a fate-statement (P3):

> What you said about the crossing is now part of what this circle is
> figuring out — it shows up in the summary as "getting across Maple
> without sprinting." If the group's picture changes because of it, you'll
> see that in the next letter, not in a notification storm. Come back
> whenever.

## 3. The conversational grammar (how deliberation moves render as talk)

Every v1 mechanism has a conversational costume; the mapping is exact and
is specified move-by-move in 03. The grammar rules:

- **Stories over positions.** Prompts elicit narrative and perspective-
  *getting*, never debate: "tell about a time…", "what would Saturday look
  like in that world?", "ask Dana what that was like for her". Never
  "imagine how they feel" (instructed perspective-taking fails — Eyal,
  Steffel & Epley 2018), never point-counterpoint.
- **The resonance gesture.** When a peer statement is shown, the reaction
  affordance is three warm labels: **"resonates"** · **"not sure"** ·
  **"I see it differently"** — rendered as a reaction row on the message,
  not a ballot. Optional one-tap qualifier when it resonates: `that's my
  life too` / `that's my hope` / `I'd back others having it` (the v1
  dimension triple in human words). ≤5 seconds per engagement (the vTaiwan
  friction budget). "I see it differently" is *always followed* by an
  optional, pressure-free "want to say how you see it?" — a divergence is
  an invitation, not a demerit.
- **Peer statements arrive as people, not content.** "Here's how someone
  across town put it — does it ring true for you?" with the statement
  quoted in the author's words (consent tier respected). Cross-cluster
  exposure is person-mediated and narrative (Broockman & Kalla), never
  decontextualized opposing content (Bail et al. 2018).
- **Future-talk is scaffolded, invisibly.** After a vision riff, the
  notetaker's next beat is the WOOP/hope sequence with no exercise named:
  "that's vivid. what gets in the way of that today?" → then later →
  "what's one small thing that would move it an inch?" (Oettingen's
  mental contrasting; Snyder's agency+pathways). Pure dream-collection is
  an antipattern (it drains action motivation — Oettingen & Mayer 2002).
- **The relational quality question** appears once per vision thread:
  "in that future — how do people treat each other?" (the warmth/
  benevolence frame that motivates across divides).
- **Affect is welcomed and routed.** "What's not working for you?" is a
  standing prompt; anger is acknowledged, never moderated away, and routed
  to prognosis: "what would better look like?" (SIMCA; Snow & Benford
  diagnostic→prognostic framing).
- **Receptiveness support in the composer.** When the person is replying
  across a mapped divide, the composer offers *optional* prefix chips
  drawn from the conversational-receptiveness recipe ("I get why you'd…",
  "It's possible that…", "We both seem to want…") — editable, never
  auto-sent, never corrective in tone, and absent entirely within
  agreement (no red-pen vibe). Because these chips machine-shape
  human→human speech, they are governed by P6's machine-suggested-speech
  clause (01 §4), not left as a style note: opener-only (the machine
  never rewrites the person's substance), visibly a suggestion until
  chosen, never pre-inserted, recipient-side rendering identical whether
  or not a chip was used, mechanism disclosed on How-unite-listens, and a
  chip long-press opens its seam (03 §6). The AI-mediated-communication
  evidence is why this is covenant-grade: even smart-reply-scale
  suggestions measurably shift what people express (Hohenstein et al.
  2023; Hancock, Naaman & Levy 2020), and discovered machine authorship
  erodes trust (Jakesch et al. 2019) — see 08 C-v2-9 for the standing
  residual.
- **Adaptive register.** The notetaker opens with exactly one light social
  beat; users who reciprocate get the relational register, task-oriented
  users get the fast lane (Bickmore). Progress is never gated on
  pleasantries.

## 4. The mirror (restatement → adoption, disguised as good listening)

After a substantive turn, the notetaker reflects it back — one sentence, in
a quieter visual style, attached under the person's own message:

> **unite** · notetaker
> Hearing you: mornings feel rushed and a bit unsafe — you want the
> crossing fixed more than you want anything fancy. Close?
> `That's it` · `Close — let me fix it` · `No, that's not it`

Mechanically (03 §2): the utterance stayed in the author's pod as a
circle message; the mirror line is the drafted decomposition (a candidate
`fut:Claim` + `fut:Need` tagged to a need concept), proposed by
`lib/mirror-draft.ts` — the deterministic drafter behind the
`DecompositionAssistant` seam (new module; strategy and fixtures in
03 §2). The three responses:

- **"That's it"** = `fut:adoptedBy` — the atom becomes the person's,
  enters the deliberation. v1's consent invariant, worn as warmth.
- **"Close — let me fix it"** = inline edit of the mirror text, then adopt.
  The correction is simultaneously repair (Ashktorab et al.: correctable
  warmth is trusted; uncorrectable warmth is creepy) and the highest-
  quality labeled signal the engine receives (Kriplean's Reflect; Xiao et
  al.).
- **"No, that's not it"** = the draft is visibly discarded ("Scrapped —
  say it your way and I'll listen better") and *nothing* enters the
  engine. Graceful re-ask, at most once.

Rules: at most one mirror per few turns (not every message — mirrors are
punctuation, not surveillance); the Max-Neef concept is *never* shown as a
taxonomy ("this sounds like it's about feeling safe and having a say —
right?" not "classified as: Protection, Participation"); a mirror the
person ignores expires silently and enters nothing.

### 4.1 When the mirror can't carry something (the C4 boundary, worn warmly)

The chat itself is **ungated**: what someone says is their own speech, in
their own pod, visible to their circle — `assertNotSensitive` does NOT run
on utterances (the gate split, 03 §2a). The C4 screen runs where the
machine layer begins: on the drafted atoms, and fail-closed at the
adoption chokepoint (`lib/pod-society.ts`, unchanged). So *"my disability
makes this crossing terrifying"* — a sentence one of the demo's own
personas would say — sends, stands, and is heard. What it cannot do is
enter the shared/aggregated picture carrying the health disclosure.

There are two shapes to this, and they behave differently. **When the
utterance also carries a clean civic line** — say *"my disability makes
this crossing terrifying. Honestly, everyone's just sprinting across Maple
before the lights change."* — the drafter takes forward **that second
sentence, verbatim-derived** (never a paraphrase of the first), and the
mirror names the boundary:

> **unite** · notetaker
> What you said stays here — in this circle and your notebook, in your
> words. The health part I can't carry into the shared picture (a hard
> data rule, not a judgment — [why](#/how)). But this line you wrote is
> already about the street itself: "everyone's just sprinting across
> Maple before the lights change." Take that one forward?
> `Take that line forward` · `Keep it all just here` · `Let me write it my way`

The take-forward is a *different sentence the person actually wrote*, not
a cleaned-up version of the sensitive one. **When the disclosure is the
whole message** — a single sensitive sentence with no clean line beside
it — the machine has nothing it may honestly carry, and the beat drops to
keep-or-write-your-own (below).

The single-sentence beat, in full:

> **unite** · notetaker
> That stays right here — in this circle and your notebook, in your
> words. I can't carry health details into the shared picture (a hard
> data rule, [why](#/how)), and I won't second-guess your words into a
> "cleaner" version — that'd be me putting words in your mouth. If you
> *want* a version for the shared picture, that's yours to write.
> `Keep it just here` · `Let me write a version to share`

Nothing is deleted and nothing is moderated away — the §3 promise holds
(the utterance stands, in the person's words, where they said it); the
boundary is a **data-protection line on what enters aggregation**, not
moderation, and the copy names the rule instead of hiding behind an error.
**No machine-sanitized reformulation is ever offered** — auto-rewriting a
health/finance disclosure into a "safe" atom is precisely the laundering
the C4 gate exists to prevent (03 §2 step 5), and it would not be the
person's adopted speech anyway. "Keep it just here" is a real, respected
choice (never re-asked as if it were wrong); "write a version to share"
hands the pen back to the person.

**Residual:** a person who wants a single-sentence sensitive point in the
shared picture must reword it themselves — a small friction deliberately
kept, because the alternative (a machine deciding which of someone's
health words are "safe" to broadcast) is the worse failure. Named,
accepted.

## 5. Elicit-before-expose (the anti-herding gate)

No surface shows the group's shape on a topic before the viewer has voiced
their own take on it (P4): a peer statement's reaction distribution renders
*after* you react ("you and 5 others — and 2 see it differently"), never
before — and only once the statement's community-wide reception clears the
k-threshold (P11); below it, the honest fallback renders instead ("a few
people have weighed in — numbers appear once enough have"). No
distribution is ever a circle-interior tally (03 §4's two-scale rule).
The circle's living summary marks themes you haven't spoken to
("we haven't heard you on this one — no pressure") rather than showing
their support levels; the garden view is community-wide and non-numeric so
it pre-biases no specific statement. This *modifies* v1's
distribution-always-visible rule in one direction only — the distribution
is still always available, but sequenced after elicitation (resolution
recorded in 03 §5).

## 6. The commons: the living summary, the letter, and the garden

**The living summary** (per circle, updated same-session — the Remesh
"reflect the room in seconds" lesson): a short "what we're figuring out
together" panel at the top of each circle —

> **What this circle is figuring out**
> Getting across Maple without sprinting · mornings that start calm ·
> whether the school run needs cars at all *(new — still forming)*
> **Where we genuinely differ:** whether slowing traffic or separating it
> is the better first move. Two sincere ways of seeing it — both in the
> group's words, [here](#).

A circle summary is **not an anonymous aggregate** — a 4–6-person room is
legible to itself, so the summary never pretends otherwise (P11's
two-scale rule, 03 §4): its lines are consented, attributed words ("in the
group's words"), it renders no tallies and no splits, and its reception
phrasing — "circling agreement" / "where we genuinely differ" / "still
forming" (the copy for the engine's `null` verdict — thin or lukewarm
data, said as such in the seam) — derives from **community-scale**
distributions, never a circle-interior count. The k-threshold (P11)
gates every characterization on the community-facing surfaces (letter,
garden). The differ-section is mandatory whenever the room computes a
disagreement (P7) and is rendered with the same visual warmth as
agreement — never as a warning color. Every line carries the quiet seam:
`why this? ›` (03 §6).

**The letter** (community-wide, monthly — the rhythmic "here's what I'm
hearing"; the living summary is the fast loop, the letter is deliberately
slow): a short digest written in the notetaker's voice, structured as
(a) what emerged, (b) **where people genuinely differ, in their own
words** (dissent preserved, Habermas-Machine style with the critique-round
distortion audit — design/03 §4), (c) what changed because people spoke
(fate-trails), (d) one invitation ("this month: bring someone who sees the
street differently — one person, personally asked"). Every synthesized
claim in the letter is **drillable to verbatim consented quotes** (the T3C
rule) — that drill-down is the letter's seam. Reading the letter is
participation (P10); each line takes a one-tap "resonates" that feeds the
matrix (03 §3).

**The garden** (the ambient collective state, on the commons): a slowly-
changing, non-numeric visual — each opinion cluster a *bed* of plants (or
constellation; final metaphor is a build-time call, 07 §6), each
group-informed-consensus statement a bridge/path physically connecting
beds, growth marking new common ground this month. Data: the same
`projectParticipants` + `rankNeeds` outputs as v1's opinion map, rendered
at the periphery (Weiser & Brown): rewards a glance, demands nothing,
shows no counts, no trends, no individual positions (your own position is
visible only to you, in your notebook). Tapping a bridge opens the
statements it stands for — with their per-cluster distributions, since by
then you're inspecting, not being herded.

## 7. Consent as conversation (the ODRL layer, worn in-context)

Nothing is asked at signup. The v1 ODRL defaults apply silently
(aggregate + synthesize permitted; quote-verbatim, government-use
prohibited; k=5 — design/01). The moments where context changes trigger
in-flow asks (P12), each one specific, each writing a policy term into the
author's pod:

- **First time a phrase would appear quoted in the circle summary:**
  > That line — "kids on bikes, not brakes" — says it better than my
  > summary would. Okay to show it in the circle's picture with your name
  > · without your name · keep it just between us?
- **First time circle output would flow to the community letter:** "Want
  what this circle concluded to go into this month's letter for the whole
  neighbourhood? Names or no names — your call."
- **Expert consultation:** "We're asking a traffic engineer about the
  crossing. She'd see the group's question and the summary behind it —
  not the chat itself. Okay?"
- **Anything institution-bound** (scope C's `fut:governmentUse`): always
  an explicit, separate ask with the persistence honesty line carried from
  v1: "once it's in a signed report, deleting your original won't unpublish
  the report — your name is only on it if you say so here."

Frequency discipline: consent moments are rare by design (context
*changes* are rare); receipts are occasional and light ("your notes helped
shape 2 of the letter's lines this month — the trail's in your notebook"),
never spammed (ownership as felt control, not chores).

## 8. Your notebook (scrutability, contestability, exit)

One tap from anywhere: **"What unite has heard from you."** Sections:

1. **Your words** — every message/story, where it lives (your pod IRI),
   its sharing tier.
2. **What I took from them** — each adopted atom in plain language ("you
   care about feeling safe crossing Maple" — the `fut:Need`; "you'd back
   car-free school streets" — a `fut:Claim`), each with *edit* and
   *remove*. Removal deletes the pod resource; the aggregate recomputes on
   next read (03 §7) — deletion actually propagates, structurally.
3. **Your reactions** — the resonance rows, restated ("you said 'I see it
   differently' to…"), each revisable (a new Resonance supersedes; latest-
   wins is already the aggregate's dedupe rule).
4. **Where you sit** — "right now you're in a part of the map that tends
   to weigh independence and quiet streets together — about a third of
   the community reads the street differently." Community-scale and
   k-gated; no such statistic is ever computed over your circle (03 §4's
   two-scale rule — a 4–6-person room gets no anonymous stats at all).
   Recomputed live, shown only to you, with the standing correction
   affordance ("that's not me → revise any reaction that put you there").
5. **Leave** — export everything (it's your pod — the export is real),
   leave a circle, or leave unite; what persists (signed artifacts your
   consent already entered) is stated plainly, not discovered later.

The notebook is the contestation surface: correcting the record *is*
editing the engine's input (Alfrink et al.'s contestability-by-design; the
Kay/Mortier scrutability line) — no complaint form, no ticket.

## 9. Accessibility floor (not a feature)

Chips always paired with free text; the message stream is an ARIA live
region (`polite`) with a static transcript view; no timeouts anywhere;
voice input; translation-ready strings; grade 6–8 copy throughout; the
garden has a text equivalent ("two groups, three bridges, one new this
month — the bridges: …"). The demo walkthrough includes a screen-reader
pass *before* any audience showing (the evaluators who matter will check —
Lister et al. 2020).

## 10. What v2 removes, explicitly (so removal is a decision, not drift)

| v1 surface element | v2 disposition |
|---|---|
| Compose wizard (need picker, intensity, consent panel) | replaced by conversation + mirror + in-context consent; the ODRL machinery unchanged underneath |
| Tri-state stance buttons + dimension selector | reaction row + optional qualifier chips (§3) |
| Needs board | absorbed into circle summaries + the letter; the instrument view remains under How-unite-listens |
| Bridging view (opinion map) | the garden (ambient, non-numeric) + notebook §4 (your own position, private); the exact map remains an instrument view |
| Convergence Room (candidate/critique/endorse chips) | the letter's draft-statement beat + circle critique-as-conversation (03 §5); steward signing stays a governance surface (unchanged — it is *for* stewards) |
| Resonance deck (card stack) | dissolved into the circle flow: the router deals the next peer statement as a conversational beat (03 §3) |
| Trust view | unchanged for governance actors; participants meet trust only as the expert's "verified" chip (05 §2) |
