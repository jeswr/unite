# Independent review: life-first revision of prototype v4

27 September 2026 · review and fixes by Claude Opus 5.5 (a separate session from the one that wrote the
revision) · scope: the uncommitted `prototype-v4/` changes and `README.md`, checked against the
life-first brief and [LIFE-FIRST-IMPLEMENTATION.md](LIFE-FIRST-IMPLEMENTATION.md). The research
committed in `e8cb040` was not reviewed or changed.

Checked: correctness, security and privacy, maintainability, accessibility, performance and design
intent, with particular attention to the optional action fields, old futures links and model labels,
unsent drafts, interview clear and consent, claims about coordination or wellbeing, and leading
wording. Prompt text states intended behaviour. It is not evidence that a live interview is unbiased or
behaves this way.

## Fixed

1. **Access and support needs could be erased in the name of privacy (important).** The draft prompt
   said "Leave out health details", and the interview prompt said not to ask for health details "and do
   not repeat any they share". Together these could strip "I need a step-free route" or "I need
   flexibility on difficult days" from a participant's reflected meaning and from their draft post,
   which is the disability and access meaning the revision exists to keep. Changed in
   `server/prompts.js`:
   - Interview: health, disability and support needs are welcome and explored as what would help, in
     the person's words; they must never be treated as something to leave out. The model must not ask
     about diagnoses, conditions, treatments, medication or medical history, and need not repeat such
     clinical details if offered. It still must not diagnose, suggest treatment or promise cures.
   - Draft: keep any stated access, health or support need, described as the need, without dropping or
     softening it. By default leave out diagnoses, conditions, treatments, medication, medical history,
     names, places and identifying details; the participant can add anything back while reviewing.
   - Synthesis: keep stated access and support needs visible rather than generalising them away.
   - The AI draft review dialog (`public/js/views/talk.js`) now says what the draft was asked to keep
     and leave out, and asks the participant to check it says what they mean.

   Publishing is unchanged: every draft still opens in the edit dialog and nothing is public until the
   participant presses Publish. Test: `tests/ai.test.js` "keeps stated access and support needs
   expressible…", which also asserts that the old blanket wording is gone.

2. **Scenario response lost its room on Cancel (minor).** *Respond, or imagine it differently* kept
   unsent text per moment but reset the room choice to the default when reopened. `openPublish` in
   `public/js/ui.js` now keeps the selected room under `<draftKey>:room` and clears it together with the
   text only after a successful publish. Other callers without a `draftKey` are unchanged. Test: source
   check in `tests/client.test.js`; behaviour in a browser is untested here.

## Checked, no change needed

- **Optional action fields.** `lifeChange` and `lifeSigns` pass through the existing `v.fields`
  allow-list (unknown fields still rejected) and `v.optionalText`, which normalises, rejects control and
  direction-override characters and counts characters, not UTF-16 units, up to 500. Omitted, `null`,
  empty and whitespace-only become `null`; any other non-string is rejected. They appear in public
  state and the export, whose notice labels them as intentions, not results. They are rendered by the
  text-only `h()` builder in `act.js`, so markup is shown as text; existing tests cover persistence,
  omission, bounds, type errors, bidi rejection, markup round-trip, HTTP and export. Ownership, concern
  holds and institutional-adoption rules are untouched. Both fields are labelled optional and as
  intended rather than measured, with visible labels and a described fieldset.
- **Old futures links and model provenance.** `#/futures/public-service`, `global-employer` and `mixed`
  show a notice that the comparison was replaced and remains in git history; other unknown segments get
  a neutral notice. The route segment is never rendered. Posts with a legacy `modelRef` keep their ID
  and are labelled as responding to an earlier model no longer shown; the server still validates
  `modelRef` against the old enum, so the fallback to the raw ID is only defensive. Nothing creates new
  model-tagged posts from the interface.
- **Drafts.** The scenario response prefills no text or stance; its draft key is per moment, survives
  Cancel, Escape and the join detour, and lives outside `main`, so live re-renders do not touch it. It is
  cleared only after the server accepts the post, so a failed publish keeps it. The interview answer
  draft is unaffected by opening the scenario dialog (separate keys).
- **Interview clear and consent.** Clear aborts any request, discards late replies, empties
  announcements, clears the unsent answer and resets the opener. The saved opener is accepted only if it
  is one of the two known demo openers, so edited tab storage cannot place arbitrary text in the
  bubble labelled "written by the demo". Withdrawing consent is unchanged.
- **No claim of actual coordination or wellbeing evaluation.** The futures view separates "What this
  prototype does now" from "Proposed, not built" (matching, allocation, ownership, care services,
  federation, governance and measuring whether lives improved). About and Act say intended changes are
  not measured. The day is labelled fictional and, since the follow-up below, introduced in one short
  line as an invented possibility, not a forecast or a current capability.
- **Leading wording and taxonomy.** Room names are ordinary-life lenses described as starting places,
  not a complete list. Income, jobs and government appear as things participants say (samples keep
  money, rent, funding rules and governments in people's own voices) and as possible means in the
  prompts, not as the endpoint. The synthesis prompt now lists post-scarcity among models not to
  advocate. Action examples describe everyday effects, not income or employment.
- **Accessibility and semantics.** Moment selection uses real links with `aria-current` inside a
  labelled `nav`; headings are h1 → h2 → h3; the response control is a `button`, the interview link an
  `a`; external links have descriptive text and `rel="noopener noreferrer"`. The moment grid collapses to
  one column on narrow screens.
- **Performance.** Static content and a few extra fields; no new requests, dependencies or storage.

## Not fixed (known, low severity or pre-existing)

- After *Withdraw AI consent*, the saved conversation stays in the tab (hidden) until the tab closes;
  clearing it needs consent to be given again first, which is local and sends nothing. Pre-existing.
- The *Clear conversation* button is disabled when there are no messages, even if an unsent answer is
  typed. Pre-existing.
- Edits to an AI-drafted or "Start from my last answer" post are lost if that dialog is cancelled
  (no draft key, since a new AI draft should replace an old one). Pre-existing.
- The new action fields have no character counter and cannot be edited after creation; browser
  `maxlength` counts UTF-16 units while the server counts characters (the server is authoritative).
- The fictional breakfast moment says money "was never the whole aspiration" for Maya. That is authored
  fiction, not a participant's words, but readers may take it as an editorial position.

## Verification actually performed

- Read the full diff and the new `futures.js`, plus `app.js`, `ui.js`, `dom.js`, `talk.js`,
  `validate.js` and the relevant `store.js` paths.
- `node --test "tests/*.test.js"` in `prototype-v4/`: **89 tests, 89 pass, 0 fail** (88 before this
  review; one test added, one extended). This includes `node --check` of every browser module and the
  existing guard against HTML-parsing sinks.
- `git diff --check`: clean.

## Limitations

- No browser was used, by instruction; root is doing browser acceptance. Dialog focus, the retained
  room choice, layout and mobile rendering are checked only by reading code and a source-level test.
- No real AI calls were made. Whether a live interviewer actually keeps access needs, avoids probing
  clinical details, stays neutral and asks one responsive question is untested; it needs review of real
  (synthetic, consented) transcripts.
- The server was not restarted, so a running preview serves the old prompt text until root restarts it.

## Follow-up after root's browser acceptance (27 September 2026, Claude Opus 5.5)

Root's browser acceptance on an isolated server (port 8770) confirmed the home page and samples, moment
links, the empty neutral response composer, unsent response text surviving Cancel and reopening,
joining, optional action fields surviving Back/Next, and verbatim action fields with `<b>` shown as
text. It found one defect and asked for one copy change. No unresolved required findings remained in
the review above.

1. **Action dialog showed "nullnull" (required fix).** In step 1 of *Propose an action*, with no
   concerns on the statement, the literal text `nullnull` appeared under "Local responses so far" and
   above *Short title*. Cause: `showBasis` in `openActionDialog` (`public/js/ui.js`) passed the two
   optional concern children to native `Element.replaceChildren`, which turns `null` into the text
   "null". It now empties the node and adds children with the existing `appendAll` from `dom.js`, which
   skips `null`, `undefined` and `false`, as `h()` already does. The concern list and hint, the version
   and tally lines, room switching, dates, the hidden step 2 and the draft inputs are unchanged (the
   inputs are separate elements that are not rebuilt). No other `replaceChildren` call passes optional
   children. Tests in `tests/client.test.js`: `appendAll` skips null, undefined and false but keeps `0`;
   a source guard fails if any browser module passes `null`, `??` or `&&` expressions to native
   `replaceChildren` (checked to flag the original pattern).
2. **Shorter introduction to the fictional day (copy).** The long note before the day ("not a
   prediction, a medical promise, a chosen political programme, AI-generated text…") is now:
   "An invented day to explore, change or reject. It illustrates a possibility, not a forecast or a
   capability this prototype already delivers." The "A fictional day" eyebrow is unchanged, and so is
   the honest context in the body ("What this prototype does now" / "Proposed, not built", the no-cure
   and no-usefulness framing). The research scenario document was not edited.

Verification: `node --check` on the changed browser modules and test file; `node --test
"tests/*.test.js"`: **91 tests, 91 pass, 0 fail** (two added); `git diff --check` clean. No browser, no
server restart, no commit. Root still needs to confirm in the browser that "nullnull" is gone, both with
and without concerns, and to check the new introduction.
