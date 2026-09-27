# Life-first revision of prototype v4

27 September 2026 · code and tests by Claude Opus 5.5 · based on
[Begin with the lives people want](../research/2026-09-restart/LIFE-FIRST-UNITE.md)
and [A day we could make possible](../research/2026-09-restart/A-DAY-WE-COULD-MAKE-POSSIBLE.md).

This is a bounded revision of the existing v4 app, not a rewrite. It changes where people start
(ordinary life rather than economic models) and lets actions say what they are meant to change in
everyday life. It does not add resource matching, allocation, ownership, care services, federation,
governance, profiles, durable storage or any measurement of wellbeing. [IMPLEMENTATION.md](IMPLEMENTATION.md),
[REVIEW.md](REVIEW.md) and earlier verification reports remain historical records of v4 as first built.

## What changed

**Rooms and samples** (`server/seed.js`). The four room IDs (`work`, `care`, `places`, `future`) are
unchanged so links and exports stay stable. Displayed names and prompts are now *Time & everyday life*,
*Care & support*, *Places & nature* and *Imagining together*. The home feed and sidebar describe them as
starting places, not a complete list. The nine fictional sample posts and four sample statements now
describe concrete moments: breakfast, early mornings at a bakery, sitting with a parent, a slow day at
home, a river bend, a hot flat. They include things worth keeping, rest, the freedom to decline help,
scepticism about big visions, and people's own mentions of money, rent, funding rules and governments.
They remain labelled fictional, with no stances, responses or actions.

**AI interview and prompts** (`server/prompts.js`, `public/js/views/talk.js`). The fixed opener asks for
one moment from an ordinary day someone would love to live, with a recent good moment or one small
gentler change as equally acceptable answers. The interview prompt asks one responsive question per
turn and gently explores why the moment matters, what is worth keeping, concrete barriers, wanted
support (including none), whose cooperation or consent is involved, and only later ways it could come
about. Money, jobs, prices and government are acknowledged in the person's own words and followed with
"what would it make possible?"; the model must not recategorise them or argue for any model, including
post-scarcity. AI abundance is a scenario, not a fact. Interpretations are offered as correctable
questions; only confirmed meaning counts. No diagnosis, treatment suggestions, cure promises, questions
about diagnoses, treatments or medical history, requests for identifying details, or consensus claims.
Health, disability and support needs are welcome and explored as what would help (a step-free route,
flexibility on difficult days). The drafting and synthesis prompts keep wanted experiences distinct
from proposed means, keep participants' own terms, keep stated access and support needs, leave out
clinical and identifying details by default, and must not invent needs, consent or agreement. (Access
needs were added in the independent review; see [REVIEW-LIFE-FIRST.md](REVIEW-LIFE-FIRST.md).) Exact-model verification, consent and privacy handling are unchanged.

The talk page adds one line of privacy guidance: nobody needs to name a health condition, person or
place ("I need a step-free route" is enough). A conversation saved in a tab now stores the opener it
was started with, so answers given to the earlier opener are still shown and sent under that question.

**A day we could make possible** (`public/js/views/futures.js`, `#/futures`). This replaces the
three-model economic comparison. A fictional day in four moments, selected with ordinary links
(`#/futures/breakfast`, `changing-plans`, `workshop`, `shared-path`), each showing: what Maya wants to
experience, today's barriers, the imagined future, what enabled it, a first experiment someone could
try today, and unresolved questions. Under the "A fictional day" eyebrow, one short line says the day is
invented, open to change or rejection, and illustrates a possibility, not a forecast or something the
prototype already delivers (shortened after browser acceptance; see the review report). Further sections explain
access without earnings tests and coordination without one permanent centre, while keeping
responsibility, scarcity and disagreement; that nobody has to be useful, productive, cured or on the
platform; a six-step path from personal accounts to revising institutions; and what the prototype does
now versus what is only proposed. Seven direct research links are included.

*Respond, or imagine it differently* opens the existing reviewed publish dialog with no text filled in
and no stance attached; unsent text and the chosen room are kept per moment if the dialog is cancelled
and cleared on publish. A normal link leads to the private interview. Old links to `#/futures/public-service`,
`global-employer` or `mixed` show a notice that the model comparison was replaced and remains in git
history (this file at `825466e`). Posts carrying an old `modelRef` are labelled as responses to an
earlier economic model that is no longer shown; their IDs are not reinterpreted.

**Actions point back to life** (`server/store.js`, `public/js/ui.js`, `public/js/views/act.js`).
Action creation accepts two optional fields, `lifeChange` ("What would improve in everyday life?") and
`lifeSigns` ("How will people know it helped?"), each up to 500 characters, multiline, with the same
text validation as other fields. Omitted, `null`, empty or whitespace-only values are stored as `null`,
so older clients keep working. Unknown fields are still rejected. The values appear in public state,
on action cards (labelled as intended, not measured) and in the export, whose notice says they are
intentions, not results. Ownership, concern holds, context review and institutional-adoption rules are
unchanged. Nothing evaluates or proves the intended change.

**Wording** (`public/index.html`, `public/js/views/about.js`, `public/js/views/feed.js`, `README.md`,
a pointer at the top of `IMPLEMENTATION.md`). Navigation, page title, home heading and About now
describe the life-first starting point; employment-centred phrasing is removed from current copy.

## Tests

`node --test "tests/*.test.js"` from `prototype-v4/`: **89 tests, 89 pass, 0 fail** after the
independent review (88 at the end of the revision, 83 before it). New or replaced:

- store: intended-change fields persist verbatim, including markup (rendered as text nodes by the
  existing `h()` builder, which the existing source guard keeps free of HTML sinks); omission, `null`,
  empty and whitespace-only become `null`; appear in the export and its notice; 500-character bound
  (counted in characters), non-text, direction-override and unknown-field rejection.
- HTTP: 400 on an over-long field; 200 with and without the fields; values served in `/api/state` and
  `/api/export` unchanged.
- prompts: the interview, drafting and synthesis prompts carry the life-first, own-words,
  confirmed-meaning, no-diagnosis and no-invented-consent rules.
- client: every moment has all six parts and an ID distinct from the earlier model IDs; the respond
  call keeps drafts and prefills no text or stance (replaces the old model-comparison source guard).

## Review

Reviewed for correctness, safety, simplicity, accessibility, performance and state handling.
Found and fixed during review: a tab's saved interview would have shown and sent the new opener above
answers to the old one (now stored per conversation); labelled `section`s for each moment part would
have added a dozen landmark regions (now plain `div`s under headings). The moment selector uses links
with `aria-current`, headings run h1 → h2 → h3, external links use `rel="noopener noreferrer"`, the
new action fields have visible labels and a described fieldset, and the moment grid collapses to one
column at 860px. The route segment is never rendered. No new dependencies.

## Limits and known gaps

- **No browser validation.** Browser automation was unavailable under the current browser policy, and
  none was attempted by other means. Layout, focus order, dialogs, mobile rendering and draft behaviour
  are checked only by reading code and Node tests. They need human browser acceptance.
- Prompt wording asks for neutrality and own-language follow-up; it cannot prove either. Live AI
  behaviour was not exercised here (tests use a fake runner). Independent human review of real
  interviews is still needed.
- Selecting a moment is a hash navigation, so, as with every route, the page scrolls to the top and
  focus moves to `main`.
- The API still accepts `modelRef`/`modelStance` on new posts for backward compatibility, though no
  interface creates them.
- Intended-change fields cannot be edited after creation and are not part of the owner's context
  review. Browser `maxlength` counts UTF-16 units while the server counts characters (existing pattern).
- Rooms are still four fixed starting places; people cannot add their own. English only; in-memory
  state; one local server.
