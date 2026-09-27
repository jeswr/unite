# Unite prototype v3: implementation notes

Unite is a worldwide shared-futures space for participatory design of
humanity's future. People describe the lives they want, explore other
people's aspirations, develop alternatives with expert help, and connect
ideas to people and institutions who can act on them. It is open in
ambition to everyone. This prototype is not: it is English-only, runs in one
browser, and has no participants, partners or institutions behind it.

It is a local, dependency-free product exploration. It is **not** a
production service or evidence of democratic legitimacy. All seeded people,
expert roles, responses, costs, dates and commitments are fictional.

Browser acceptance of this revision is recorded separately in the project's
[verification notes](../research/2026-09-restart/VERIFICATION.md). The final
acceptance run covers the global framing, privacy, decision funding remit,
versioned exports, reset and phone layout.

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
| `index.html` | The demo: how Unite works, describe, explore, then the worked example (options, evidence, decision/delivery), export/reset |
| `reader.html` | Read-only reader that renders an exported bundle from the file alone |
| `css/styles.css` | Shared styling (system fonts, no remote assets) |
| `js/schema.js` | Vocabularies, limits, currency and record validators used by import, storage and tests |
| `js/seed.js` | Fictional seed content: six aspirations and one worked example |
| `js/model.js` | Pure state operations: drafts, sharing, bookmarks, responses, questions, decision, funding rules, delivery |
| `js/bundle.js` | Public export builder and hostile-input parser |
| `js/storage.js` | `localStorage` load/save with corruption, unavailability and earlier-version handling |
| `js/dom.js`, `js/forms.js`, `js/views.js` | Text-only DOM builder, accessible form errors/status, shared read-only renderers |
| `js/app.js`, `js/reader.js` | Page controllers |
| `tests/*.test.js` | `node:test` suites |

## Content: a wider purpose and one labelled example

- **The aspiration space is the purpose.** Six fictional descriptions cover
  learning, health and care, work and livelihoods, climate and nature,
  housing and belonging, and voice and fairness. Each is one person's lived
  experience, with a trade-off or something to protect. No region or country
  is attached to any of them, and the page says they stand for no country or
  group.
- **The proposal is a clearly labelled worked example,** "Learning
  opportunities for everyone". Its section, eyebrows and proposal title all
  say "Example", and its remit says the group speaks only for itself and
  cannot set policy for any employer, school, government or country.
- **Three kinds of outcome are kept apart,** in the copy and in the data.
  Aspirations are for discussion. Each option carries a `scope`: `current`
  (current provision), `experiment` (a community experiment the example
  group can fund) or `recommendation` (needs an institution to adopt and
  fund it). The decision rules enforce the difference; see below.
- **Costs are participation and delivery costs, not software budgets.** The
  experiment is about US$2,000 for 90 days (rooms, travel, childcare, data,
  printing). The recommendation is unfunded here. Every estimate is labelled
  fictional, and the only "statistic" (half of starters finishing) is marked
  as invented, with how a real experiment would measure it. Building the
  software itself is cheap with AI assistance (the project owner reports the
  previous demo cost about US$10 or less in AI coding credits), so the UI
  shows no platform operating budget.
- **Experts have disclosed interests:** an adult learning and access adviser
  who writes open materials, and a labour and community delivery adviser who
  works for an organisation campaigning for paid learning time.

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
  a date, and an explicit funding position:** either a whole-US-dollar budget
  *allocation* or "no budget allocated". The authority is copied from the
  commitment.
- **Responsible authority limits the money.** A budget may be allocated only
  to an option whose scope is `experiment`, and only up to the commitment's
  `proposedBudget` (US$2,000). Current provision spends nothing new, a
  deferred decision allocates nothing, and a recommendation cannot be funded
  from the example budget. Choosing the recommendation stops the trail at
  "decision recorded" with an explanation that adoption and funding belong
  to a separate institution. The same rule (`fundingProblem` in `model.js`)
  runs on form input, on import and on load.
- **Selected ≠ funded ≠ delivered ≠ evaluated.** The delivery trail moves
  one state at a time (proposed → decision recorded → funds confirmed → in
  progress → delivered → evaluated), and each step needs acceptance
  evidence. Allocating a budget is part of the decision. "Funds confirmed"
  is the later step where the budget holder confirms the release. It is
  stored under the key `resources-committed`, and the decision record shows
  both facts, for example "Budget allocated: US$2,000" and "Funds confirmed:
  Not yet". A no-budget or deferred decision stops the trail at "decision
  recorded". A second, seeded commitment (a volunteer group's answer about a
  step-free room) shows an overdue missing response, computed from the
  device date.
- **Imports are untrusted.** The size cap (512 KB) is checked before
  reading or parsing. After that come a JSON parse guard, exact `format`,
  `schemaVersion` and `currency`, and rejection of unknown top-level keys
  (including `drafts` and `__proto__`). Each record is checked with field
  allow-listing, enum and identifier patterns, length limits and list caps.
  Control and bidi-override characters are rejected, and so are impossible
  calendar dates and times. There are also checks for duplicate IDs,
  references and delivery-trail rules, plus these consistency rules:
  - Every concern response is attached to the decision exactly once, as an
    unchanged copy, and nothing else is attached.
  - The decision, the delivery trail and the commitment all name the same
    commitment, and the decision's authority matches the commitment's.
  - The decision's funding obeys the scope and budget limit above.
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
  remains only as a reported last resort. Reset removes only the current
  example's two keys.
- **Withdrawal does not cascade.** Withdrawing a shared copy removes only
  that copy. Shared records it inspired keep their content, lose the link and
  get `inspirationWithdrawn: true`, shown as "Inspired by: a description that
  was later withdrawn". Decisions, concerns and the trail are untouched.

## Data format and saved-data compatibility

The earlier revision used a different example, with its own option IDs and
amounts in euros. Relabelling its saved responses, decisions or money as
answers to the learning example would misrepresent them, so this revision
starts a clean context instead of migrating.

| | Earlier example | Current example |
|---|---|---|
| `localStorage` keys | `unite-demo-v3`, `unite-demo-v3-unreadable` | `unite-demo-learning-example`, `unite-demo-learning-example-unreadable` |
| `storageVersion` | 1 | 2 |
| Export `schemaVersion` | 1 | 2 |
| Currency | euros, implicit | `"currency": "USD"`, required |

- **Earlier saved data is never read, rewritten or deleted,** and reset does
  not touch it. `hasLegacyData` only checks whether either earlier key
  exists. If one does, the page explains that the data is kept, is not shown,
  and can be removed through the browser's site-data settings.
- **Earlier exports are refused, not converted.** A version 1 file gets a
  specific message saying it comes from the earlier example, with amounts in
  euros, and that nothing is converted. A version 2 file without
  `"currency": "USD"` is refused too.
- Exported file names include the example and version, for example
  `unite-demo-learning-example-v2-2026-09-26.json`.
- Within version 2, `inspirationWithdrawn` is optional and defaults to
  false.

## What the earlier design contributed

- **v1 (`design/01–06`):** dissent as a first-class, permanently carried
  artifact. Needs described in people's own words, separate from proposals.
  Private-versus-shared data boundaries with explicit consent as a
  substantive rule, not decoration. A self-critique culture, carried on in
  the limits below.
- **v1 tri-state resonance** became three plain stances ("could support",
  "have a concern", "need information") with optional reasons.
- **v2 (`design/v2`):** the "reveal test" and ambient-honest disclosure (the
  demo notice, the "not an AI summary" labels). Experts with disclosed
  interests. Commitment banners, fate-trails and honest ignoring became the
  commitment card, the delivery trail and the overdue example.

## Deliberate choices

- **No opinion map, PCA, k-means or bridging score.** Polis-style mapping is
  useful for sensemaking but is not a selector of the best idea, and it is
  unreliable at small scale. This demo adds no new ranking algorithm.
- **No simulated AI notetaker or scribe.** A demo that fakes AI output would
  mislead. Any future AI summary would need author confirmation and source
  tracing (see Tessler et al., 2024).
- **No login, identity credentials or network protocol.** These would not
  settle eligibility, representation, legal authority, moderation, deletion
  of copies already shared, or funding. Portability is a plain, versioned
  JSON export. Interoperability with existing participation tools stays a
  generic future requirement, not tied to any particular technical
  ecosystem.
- **Decision authority is central.** The named decision owner, remit,
  budget limit, response date and published reasons are the core of the
  loop, following the OECD guidance on meaningful remit and public response.
  Funding (who pays) and delivery (who does the work, and whether it
  happened) are separate steps.
- **One small example inside a larger purpose.** Plain ES modules replace
  React, Vite and npm, so there is nothing to install.

## Self-review (five axes)

- **Correctness.** 45 `node:test` tests cover privacy, round trip, hostile
  imports, decision rules, the scope and budget-limit funding rules, the
  allocation/confirmation split, delivery transitions, storage corruption,
  earlier-version storage and exports, withdrawal and the
  independent-review regressions below. `node --check` passes on every file,
  and `app.js` and `reader.js` link as modules. Claude's checks were performed
  from the command line; Codex's subsequent browser acceptance is recorded
  in the linked verification notes.
- **Readability.** Model, schema, bundle and storage are pure and separate
  from the DOM. `app.js` is the largest file (about 740 lines) because it
  wires six sections. Splitting it per section would be the next refactor if
  it grows.
- **Architecture.** One validator set serves import, storage recovery and
  export, and one funding rule serves form input, import and load. The
  shared `views.js` renderers give the reader and the demo the same
  presentation of options, concerns, decisions and trails. Because they
  share code, the reader is a second view, **not an independent
  implementation**.
- **Security.** No `innerHTML` or HTML-string sinks. No network, analytics or
  remote assets. CSP is set by `<meta>`, so `frame-ancestors` is not
  enforceable there. `localStorage` is plaintext and readable by anyone with
  access to the browser profile, and the UI says so. Earlier-version data is
  only checked for existence, never parsed.
- **Performance.** The public bundle is rebuilt and validated on each render.
  That is trivial at demo scale, with lists capped at 500 records.

## Independent-review fixes (earlier revision)

A separate review of the data modules found one High and three Medium
issues, plus two Low ones. All were reproduced and fixed, and each has a
regression test that still runs against the current example.

| Finding | Fix |
|---|---|
| **High.** Withdrawing an inspiration broke export, and the next load silently wiped the decision and all public records. | Withdrawal marks dependants `inspirationWithdrawn` instead of leaving a dangling link. Storage repairs dangling links the same way. Clearing all public records is now a reported last resort that the repairs normally avoid. |
| **Medium.** Import accepted a decision whose attached concerns disagreed with the concern responses. | Two-way match by `responseId`, with identical option, reason and author, and no duplicates. The same check runs on load. |
| **Medium.** Import accepted a decision, commitment and trail that disagreed. | Same commitment on decision and trail, authority equal to the commitment's, decision ⇔ "decision recorded" step with a matching timestamp, and `responseRecorded` true only for the decided commitment. |
| **Medium.** Disclosures and attribution were taken on trust from the file. | The notice must equal the built-in text. Seed IDs must keep their built-in authors, and every other record must be "Participant in this browser". The same attribution rule applies on load. |
| **Low.** Impossible dates such as `2026-02-31` and times such as `T24:00` rolled over instead of being rejected. | Parsed values must print back as the same date and time. |

Other behaviour from earlier frontend passes that carries over: "Budget
allocated" and "Funds confirmed" are labelled separately; the scope
explainer is a collapsed native `<details>` that opens when its anchor is
followed; the share dialog lists what is copied from the draft; the Explore
count is refreshed whenever totals change; and the reader turns unexpected
parse errors into a plain message.

## Known limits and production gaps

- **Global in ambition only.** English (en-GB) only. No translation,
  right-to-left layout, low-bandwidth, offline, voice, SMS or assisted
  (someone-helps-you) participation; these are future work, not features.
  No automated accessibility audit or screen-reader testing has been done
  yet. The `<search>` landmark needs a recent browser.
- Single-browser simulation. "Participant in this browser" is not an
  identity, and nothing checks for unique or real people. Anyone can
  role-play the decision owner.
- Self-selected, tiny input. Nothing here is representative of any place or
  population, and it must not be presented as a mandate. Real use needs
  deliberate recruitment where legitimacy is claimed, facilitation, a public
  response and an independent evaluation.
- The example group's authority is only as real as its commitment. A
  recommendation recorded here is published, not adopted: the demo cannot
  record whether any institution took it up.
- Withdrawing a shared copy removes it only from this browser. The
  confirmation text says a real shared service could not guarantee deletion
  of copies already sent. Records it inspired show that the inspiration was
  withdrawn. A private draft that cited it simply loses the link.
- **No signatures, so no proof of origin.** The consistency rules catch a
  file that contradicts itself. They cannot catch a consistent edit: for
  example, deleting a concern response *and* its attached copy, relabelling
  an option's scope in a file, or changing seed text while keeping its
  attribution. A test documents that the first of these is accepted.
- Earlier-version data stays in the browser until the person clears site
  data. The demo offers no export or viewer for it.
- Import reports only the first schema problem it finds.
- No private backup export. It was deliberately left out of scope.
- The overdue status depends on the device clock. Seed dates are fixed
  around August to November 2026.
- Real use would need: remit and response agreements with real institutions
  for each recommendation; moderation; data-protection assessment across
  jurisdictions (aspirations can reveal health, religion, migration status
  and politics); identity and eligibility design; durable, access-controlled
  storage; interoperability with existing participation tools rather than a
  rewrite; and evaluation of outcomes beyond apparent agreement.
