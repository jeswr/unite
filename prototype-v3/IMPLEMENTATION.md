# Unite prototype v3: implementation notes

Final browser acceptance performed after these engineering notes is recorded in [Verification and provenance](../research/2026-09-restart/VERIFICATION.md), including the share-dialog metadata and reset-count fixes.

A local, dependency-free product exploration. It is **not** a production
service, a deployed federation, or evidence of democratic legitimacy. All
seeded people, expert roles, support, budgets, dates and commitments are
fictional.

## Run and test

No install step. From this directory:

```sh
python3 -m http.server 8000     # then open http://localhost:8000/ and /reader.html
node --test tests/*.test.js     # Node 20+; data-invariant tests, no dependencies
```

ES modules need an HTTP origin, so opening `index.html` from `file://` will not
work. `package.json` exists only to set `"type": "module"` and a `test` script.
It has no dependencies.

## Files

| Path | Role |
|---|---|
| `index.html` | The demo: pilot, describe, explore, options, evidence, decision/delivery, export/reset |
| `reader.html` | Read-only reader that renders an exported bundle from the file alone |
| `css/styles.css` | Shared styling (system fonts, no remote assets) |
| `js/schema.js` | Vocabularies, limits and record validators used by import, storage and tests |
| `js/seed.js` | Fictional seed content |
| `js/model.js` | Pure state operations: drafts, sharing, bookmarks, responses, questions, decision, delivery |
| `js/bundle.js` | Public export builder and hostile-input parser |
| `js/storage.js` | `localStorage` load/save with corruption and unavailability handling |
| `js/dom.js`, `js/forms.js`, `js/views.js` | Text-only DOM builder, accessible form errors/status, shared read-only renderers |
| `js/app.js`, `js/reader.js` | Page controllers |
| `tests/*.test.js` | `node:test` suites |

## Invariants the code enforces (and the tests check)

- **Private drafts never leave the browser's private store.** The export is
  built by allow-listing public record types. It never reads `drafts` or
  `bookmarks`, and the result goes through the import validator, which drops
  unknown fields. Sharing creates a *separate* record from text the
  participant reviews in a dialog. "What must be protected" starts empty
  there, and later draft edits do not propagate to the shared copy. The
  topic, time horizon and inspiration link are copied from the draft as
  they are, so the dialog lists them under "Also copied from your draft".
- **Dissent is carried, not scored.** No aggregates, counts-as-scores,
  clustering or consensus labels. Concerns are listed first and separately on
  every option. When a decision is recorded, a snapshot of every concern
  (seeded and local) is attached, and responses close so the snapshot cannot
  drift.
- **A decision needs a named owner, public reasons (20 characters or more),
  a date, and an explicit funding position:** either a whole-euro budget
  *allocation* or "no budget allocated". A deferred decision cannot allocate
  a budget. The authority ("community pilot budget, not a public mandate")
  is copied from the commitment.
- **Selected ≠ funded ≠ delivered ≠ evaluated.** The delivery trail moves
  one state at a time (proposed → decision recorded → funds confirmed → in
  progress → delivered → evaluated), and each step needs acceptance
  evidence. Allocating a budget is part of the decision. "Funds confirmed"
  is the later step where the budget holder confirms the release. It is
  stored under the unchanged key `resources-committed`, and the decision
  record shows both facts, for example "Budget allocated: €18,000" and
  "Funds confirmed: Not yet". A no-budget or deferred decision stops the
  trail at "decision recorded". A second, seeded commitment shows an overdue
  missing response, computed from the device date.
- **Imports are untrusted.** The size cap (512 KB) is checked before
  reading or parsing. After that come a JSON parse guard, exact `format` and
  `schemaVersion`, and rejection of unknown top-level keys (including
  `drafts` and `__proto__`). Each record is checked with field
  allow-listing, enum and identifier patterns, length limits and list caps.
  Control and bidi-override characters are rejected, and so are impossible
  calendar dates and times. There are also checks for duplicate IDs,
  references and delivery-trail rules, plus these consistency rules:
  - Every concern response is attached to the decision exactly once, as an
    unchanged copy, and nothing else is attached.
  - The decision, the delivery trail and the commitment all name the same
    commitment, and the decision's authority matches the commitment's.
  - A decision exists exactly when the trail has a "decision recorded" step
    with the same timestamp.
  - `responseRecorded` is true exactly for the decided commitment.
  - The disclosure notice must equal the built-in text, and the reader
    shows only its own copy.
  - Seed record IDs must carry their built-in fictional attribution, and
    every other record must be "Participant in this browser".

  Rendering uses text nodes only. Both pages also set a restrictive CSP
  (`connect-src 'none'`, no inline script or style).
- **Storage failures degrade gracefully.** Blocked storage means the demo
  runs in memory with a visible notice. Unreadable JSON starts fresh and
  keeps the raw text under a separate key until reset. Tampered records
  (wrong label, reused ID, failed validation) are dropped one by one and the
  count is reported. A dangling "inspired by" link is repaired, not dropped.
  A decision that fails the consistency rules is removed on its own, with
  its own notice, and other records stay. Clearing all public records
  remains only as a reported last resort. Reset removes only this demo's two
  keys.
- **Withdrawal does not cascade.** Withdrawing a shared copy removes only
  that copy. Shared records it inspired keep their content, lose the link and
  get `inspirationWithdrawn: true`, shown as "Inspired by: a description that
  was later withdrawn". Decisions, concerns and the trail are untouched.

## What the earlier design contributed

- **v1 (`design/01–06`):** dissent as a first-class, permanently carried
  artifact. Needs described in people's own words, separate from proposals.
  Private-versus-shared data boundaries (pods plus consent) as a substantive
  rule, not decoration. A self-critique culture, carried on in the limits
  below.
- **v1 tri-state resonance** became three plain stances ("could support",
  "have a concern", "need information") with optional reasons.
- **v2 (`design/v2`):** the "reveal test" and ambient-honest disclosure (the
  demo notice, the "not an AI summary" labels). Experts with disclosed
  interests. Commitment banners, fate-trails and honest ignoring became the
  commitment card, the delivery trail and the overdue example.

## Deliberate changes from earlier work

- **No opinion map, PCA, k-means or bridging score.** Polis-style mapping is
  useful for sensemaking but is not a selector of the best idea, and it is
  unreliable at small scale. This demo adds no new ranking algorithm.
- **No simulated AI notetaker or scribe.** A demo that fakes AI output would
  mislead. Any future AI summary would need author confirmation and source
  tracing (see Tessler et al., 2024).
- **No Solid pods, login, verifiable credentials or ActivityPub.** These are
  building blocks. They do not settle eligibility, representation, legal
  authority, moderation, deletion of remote copies, or funding. The export is
  a plain JSON format and makes no Solid or ActivityPub claim.
- **Decision authority is central.** The v1/v2 surfaces focused on
  convergence. This version makes the named decision owner, remit, budget,
  response date and published reasons the core of the loop, following the
  OECD guidance on meaningful remit and public response.
- **One bounded pilot instead of a platform.** Plain ES modules replace
  React, Vite and npm, so there is nothing to install.

## Self-review (five axes)

- **Correctness.** 41 `node:test` tests cover privacy, round trip, hostile
  imports, decision rules, the allocation/confirmation split, delivery
  transitions, storage corruption, withdrawal and the independent-review
  regressions below. A browser acceptance pass (private draft, community
  and export exclusion, deliberate sharing with "must protect" omitted by
  default, unresolved list, decision field errors, a decision with four
  concerns, export → reader) passed *before* the review fixes. The fixes
  below were checked by the tests, `node --check` on every file, and module
  linking of `app.js` and `reader.js`. A later browser check confirmed the
  collapsed explainer, the funding wording, reopening a valid export and
  rejecting a file with a deleted attached concern. It found the stale
  Explore count below. That fix has **not** yet been re-run in a browser.
- **Readability.** Model, schema, bundle and storage are pure and separate
  from the DOM. `app.js` is the largest file (about 700 lines) because it
  wires six sections. Splitting it per section would be the next refactor if
  it grows.
- **Architecture.** One validator set serves import, storage recovery and
  export. The shared `views.js` renderers give the reader and the demo the
  same presentation of concerns, decisions and trails. Because they share
  code, the reader is a second view, **not an independent implementation**.
- **Security.** No `innerHTML` or HTML-string sinks. No network, analytics or
  remote assets. CSP is set by `<meta>`, so `frame-ancestors` is not
  enforceable there. `localStorage` is plaintext and readable by anyone with
  access to the browser profile, and the UI says so.
- **Performance.** The public bundle is rebuilt and validated on each render.
  That is trivial at demo scale, with lists capped at 500 records.

## Independent-review fixes

A separate review of the data modules found one High and three Medium
issues, plus two Low ones. All were reproduced and fixed, and each has a
regression test.

| Finding | Fix |
|---|---|
| **High.** Withdrawing an inspiration broke export, and the next load silently wiped the decision and all public records. | Withdrawal marks dependants `inspirationWithdrawn` instead of leaving a dangling link. Storage repairs older dangling links the same way. Clearing all public records is now a reported last resort that the repairs normally avoid. |
| **Medium.** Import accepted a decision whose attached concerns disagreed with the concern responses. | Two-way match by `responseId`, with identical option, reason and author, and no duplicates. The same check runs on load. |
| **Medium.** Import accepted a decision, commitment and trail that disagreed. | Same commitment on decision and trail, authority equal to the commitment's, decision ⇔ "decision recorded" step with a matching timestamp, and `responseRecorded` true only for the decided commitment. |
| **Medium.** Disclosures and attribution were taken on trust from the file. | The notice must equal the built-in text. Seed IDs must keep their built-in authors, and every other record must be "Participant in this browser". The same attribution rule applies on load. |
| **Low.** Impossible dates such as `2026-02-31` and times such as `T24:00` rolled over instead of being rejected. | Parsed values must print back as the same date and time. |

Other changes from the final frontend pass:

- **Allocated vs. confirmed funds.** A browser run showed "€18,000
  committed" on the decision next to "Resources committed: Not yet" on the
  trail. The labels now read "Budget allocated" and "Funds confirmed". The
  decision record shows both, and the funding field explains the split.
  Stored keys are unchanged.
- **Scope explainer.** "What this demo is, and is not" is now a native
  `<details>`, collapsed at first. The demo banner and the inline storage
  and consent notes still show. The section keeps its `#about-demo` anchor,
  a heading and a descriptive summary, and following the banner link opens
  it.
- **Share dialog.** It now lists the topic, time horizon and inspiration
  that are copied with the shared record.
- **Explore count.** After a reset, the Explore status still said "Showing
  7 of 7" with six cards. The count was only set at load and on filter
  changes, so sharing, withdrawing, deleting and importing also left it
  stale. `renderExplore` now rewrites the count whenever it changes. An
  unchanged count leaves a bookmark message in place.
- **Reader robustness.** `parseBundle` no longer rethrows unexpected errors.
  They become a plain message, not an unhandled rejection.

Also reviewed, with no change needed: all rendering goes through text nodes,
with no HTML sinks, and selectors built from IDs use `CSS.escape`. Every form
control has a `<label>` or a legend. Dialogs use `showModal` with labelled
titles, focus the first control, and return focus or move it to a stable
target after re-rendering.

## Known limits and production gaps

- Single-browser simulation. "Participant in this browser" is not an
  identity, and nothing checks for unique or real people. Anyone can
  role-play the decision owner.
- Self-selected, tiny input. Nothing here is representative, and it must not
  be presented as a mandate. A real pilot needs deliberate recruitment where
  legitimacy is claimed, facilitation, a public response and an independent
  evaluation.
- Withdrawing a shared copy removes it only from this browser. The
  confirmation text says a real federation could not guarantee deletion of
  copies already sent. Records it inspired show that the inspiration was
  withdrawn. A private draft that cited it simply loses the link, since the
  withdrawn copy was the participant's own.
- **No signatures, so no proof of origin.** The consistency rules catch a
  file that contradicts itself. They cannot catch a consistent edit: for
  example, deleting a concern response *and* its attached copy, rewording
  the local records, or changing seed text while keeping its attribution. A
  test documents that the first of these is accepted.
- `inspirationWithdrawn` was added to schema version 1 as an optional field
  that defaults to false. An older reader would drop it, not reject it.
- Import reports only the first schema problem it finds.
- No private backup export. It was deliberately left out of scope.
- The overdue status depends on the device clock. Seed dates are fixed
  around September to November 2026.
- English (en-GB) only. No automated accessibility audit or screen-reader
  testing has been done yet. The `<search>` landmark needs a recent browser;
  older ones treat it as a plain block.
- Real use would need: governance and remit agreements with a real
  institution; moderation; data-protection assessment (needs can reveal
  health, religion and politics); identity and eligibility design; durable,
  access-controlled storage; interoperability with existing participation
  tools such as Decidim or CONSUL rather than a rewrite; and evaluation of
  outcomes beyond apparent agreement.
