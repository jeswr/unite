# v4 review record

This review is by Claude Opus 5.5. It has three sources:

1. The independent backend review (`claude-unite-backend-findings.md`, F1–F9 and nits). That review read only the server code, while the UI was still unfinished.
2. Root's first browser acceptance run.
3. My own review of the finished frontend and its API contracts, done with the five-axis `code-review-and-quality` checklist.

Every fix below was verified with `node:test` (83 tests, all passing) and `node --check`. **I did no browser checks in this pass.** Root will repeat the visual, mobile and multi-tab checks. Where a test only reads source text, it is marked as a guard, not a browser result.

## Backend findings (F1–F9)

| # | Finding | Resolution |
|---|---|---|
| F1 | Concerns inherited at creation, new concerns and statement revisions did not affect readiness. | **Fixed.** Each action depends on a *room context*: the current statement version plus the concern stances on it, identified by a hash (`context.id`). Only the owner can clear the hold, with `POST /api/actions/:id/review {contextId, text}`. The server accepts the review only if `contextId` matches the context at that moment; otherwise it returns 409, so a review cannot cover changes the owner has not seen. The review record keeps the reviewer, the reason, the version and every concern reviewed, and the concerns stay on the statement. A later revision or a new or reworded concern needs a fresh review. New support or abstain responses, and a concern that is withdrawn, need no review. They still appear as information under "Changed since creation". The `context-review` blocker holds only forward status moves. There are at most 20 reviews per action; after that the action stays on hold (fail-closed). Tests cover real transitions, stale reviews after a concurrent change (store and HTTP), owner-only review, and review with nothing to review. |
| F2 | Institutional proposals could reach `done`, which implied adoption. | **Fixed without capping.** Proposal work stays usable up to `done`. Every institutional action has `institutionalAdoption: "unconfirmed"`, which no request can change, and a server-written `statusMeaning`: for example, `done` reads "Proposal work completed; institutional adoption unconfirmed." Neither the institution name nor the card status is ever treated as adoption or funding. The export has the same fields and says this in its notice. Tests show a client-sent `institutionalAdoption` is rejected. |
| F3 | Every tab's event stream could use up the browser's ~6 connections per host. | **Fixed with a simple policy, no leader election.** A hidden tab closes its stream (status "Paused while hidden"). When the tab is shown again it reopens the stream, and the first frame resyncs it. A visible window that has had no focus for 20 s switches to 3-second polls of the new `GET /api/rev` (a few bytes), and regains its stream on focus. A stream that fails to open within 6 s is treated as a full connection pool and also falls back to polling ("Many tabs open…"). In practice only the focused window, plus any window focused in the last 20 s, holds a stream. Drafts survive every refresh, because refreshes use the existing draft-preserving re-render. Tested in node with stand-in document, window and EventSource objects. **Not tested in a browser, and not with 6 real tabs.** |
| F4 | The concern-history cap could lock a concern as addressed. | **Fixed.** Recording a response needs room for one more history entry, so the raiser can always reopen. At the cap the concern stays open, with a message suggesting discussion or a new action. The archive budget reserves the reopen too. A test drives the history to the cap edge. |
| F5 | The check-in date was rejected for users west of UTC in the evening. | **Fixed.** Local dates run from one day behind to one day ahead of UTC (UTC−12 to UTC+14), so the server accepts from UTC-date −1 to +366 days. It rejects only dates that are "before today" in every time zone. Tests cover UTC−7 in the evening and UTC+14 in the morning. |
| F6 | Combined state could grow very large, and every change was rebuilt per tab. | **Fixed for a local prototype.** One shared `archiveBudget` (20,000 records) covers every record copied into history: closed-version responses, snapshot concerns, concern history, updates and reviews. At the limit, writes are **refused** with 503. Nothing is deleted. The public state JSON is built once per revision, and the AI status is spliced in per request. There are also global limits: 600 writes/min across all participants, 1,200 state reads/min and 20 exports/min. Tests cover each. |
| F7 | The `aiAssisted` flag is set by the client. | **Labelled honestly; no server-issued ID.** The flag is still client-declared, because the server cannot prove who wrote an edited text even with an ID. Public versions carry `aiAssistedSource: "self-declared by the proposer, not verified"`. The UI badge reads "AI-assisted (declared by the proposer)", and the export notice and About both say it is not verified. In the browser, "Edit and propose" from an AI suggestion always sends the label: the checkbox is checked and cannot be changed. Any other proposer can declare AI help with a checkbox. |
| F8 | The synthesis prompt lacked political-economy neutrality. | **Fixed.** The prompt now requires neutrality between systems (it names public-service, global public employment, cooperative, market and mixed). It says a view in a single post must stay visible as a difference, forbids weighting views by frequency, and forbids invented views or balance. It also keeps source IDs exact and restates that people will review or reject the suggestion. Sources are still shown, the suggestion is still private, and a human still proposes it. A test asserts each rule. |
| F9 | Model verification and CLI flags were unverified. | **No change, as instructed.** Root ran `claude --help` and a real synthetic call; the exact-model check passed on the installed CLI. Exact `claude-opus-5-5` validation is unchanged, with no fallback. |

### Nits

- **Fixed:** SSE clients are now dropped on `res` `close`.
- **Fixed:** a "busy" AI refusal no longer uses up the participant's AI quota (tested).
- **Fixed:** interview length is counted in code points, and the interview body limit was raised to 160 KB, which fits 30,000 four-byte characters (tested).
- **Fixed:** `droppedSources` now counts only unknown IDs, not duplicates or IDs beyond the cap (tested).
- **Not changed: LRM/RLM/ALM (U+200E, U+200F, U+061C).** These marks are used legitimately in Arabic and Hebrew text. Rejecting them would refuse real posts in order to close a minor spoofing gap. Bidi *overrides and isolates* are still rejected.
- **Not changed: shutdown.** `closeAllConnections()` closes the AI request's response. That fires the abort that SIGTERMs the child, and SIGKILL follows 2 s later. A child could outlive `process.exit` by at most that grace period. This is acceptable for a local demo.
- **Documented:**
  - Closed-version responses keep the display name from when the version closed.
  - Non-browser tools must send `Origin` and `X-Unite-Client`.

## Acceptance findings (root's browser run)

- **Hidden elements were visible** (the action dialog's step 2, the institution field, Back and Create). **Cause:** author `display` rules (`.field` is a grid, buttons are inline-flex) overrode the browser's `[hidden]` rule. **Fix:** a global `[hidden] { display: none !important; }`. I inspected every `hidden` use: all of them are in the action dialog, and all are covered by this rule.
  - Step navigation validates only step 1 fields, and only on Next or Enter. Back never validates.
  - Enter in a step 1 field now acts as Next instead of doing nothing.
  - Focus moves to the first field of the step being shown.
  - A source guard test checks that the rule stays in the CSS. **The rule has not been re-checked in a browser.**
- **Futures content:**
  - The public-service model is now labelled "One proposed interpretation". Its note explains that the founder asked to explore universal public contribution, including government employment, and has not settled on a design.
  - The global-employer model is presented at its strongest: constitutional devolution to local and worker councils, portable rights, independent courts and unions, freedom to refuse tasks, and basic security independent of work. Its hard problems are still named: no alternative employer, central override, coordination, financing, consent and concentrated power.
  - The comparison no longer says "Weak: set centrally". Local say "depends on enforceable devolution" in every model, and a new row covers what you can do if your employer treats you badly.
  - All strengths and risks are headed "Possible…". A note says every cell is a hypothesis and that the research leaning towards plural institutions is not a verdict.
  - All model badges share one neutral style, and every model can still be rejected.
- **Phone layout (390 px):**
  - The header is a compact bar: brand and identity on one row, then scrollable primary navigation and rooms.
  - The persistent notice is one short sentence that keeps its key facts: local demo, fictional samples, public posts lost on restart, and a link to About this demo.
  - Generic introductions are hidden on phones, but the room prompt and the Act and Futures framing stay.
  - The room summary above the feed shows its counts and a link, but not the full statement.
  - Search and filters fold into a closed panel on phones, which opens by itself when a filter is active.
  - The composer starts short and grows when focused. Desktop is unchanged apart from the shorter notice and the filter panel (open by default).
  - **Not measured in a browser.**
- **Private interview text left in the page after Clear:**
  - Cause: the live region kept "Unite asks: …".
  - Announcements now clear themselves after 8 s.
  - Clear conversation and Withdraw AI consent both empty the live region at once. They also abort any request in flight, and a reply that arrives later is discarded instead of being re-added or announced (an epoch check).
  - Clear also deletes the unsent typed answer. Accessible announcements are kept.
  - No node test exists for this, because it needs a DOM. Root should re-check `document.body.textContent` in the browser.

## Frontend and API contract review (my own findings)

- **Fixed: refresh coalescing could lose an update.** A live event or a finished mutation that arrived during an in-flight `/api/state` fetch received that older fetch's promise. If the response had left the server before the change, the tab stayed stale until the next event. `refresh()` now fetches again whenever a refresh was requested mid-flight.
- **Fixed: an action dialog open during a statement revision** only showed the 409 message, and its "basis" still showed the old version. It now refreshes, redraws the basis at the current version, returns to step 1 and explains. The typed fields are kept.
- **Fixed: owner controls matched the new holds.** "Move to …" buttons are disabled for both open concerns and a pending context review, with a hint naming what is missing. The owner's review form shows the room's current statement and concerns, the exact context the server will check.
- **Checked, no change needed:**
  - Text rendering. `h()` only creates text nodes and attributes. A test forbids HTML sinks. Links are built only from server IDs and fixed routes.
  - Dialog focus. The first field is focused on open, and focus returns to the opener on every close path (Escape included). There is one close path.
  - Model calls. `aiRequest` is called only from Send, Try again, Draft with AI and Ask AI, all behind consent. Nothing calls the AI on load, on live events or on refresh.
  - Stop and cancel. Stop aborts the fetch (the server kills the CLI), and failed turns can be retried.
  - Private text is published only through the publish dialog's explicit Publish button, after editing.
  - Stale-version stances and revisions get a 409 with the server's message. The typed text is kept (the statement editor stays open).
  - Live re-renders keep every `data-draft` control, including the new review form.
  - No new control fakes activity.

## Remaining limits

- There are no browser, screen-reader, mobile or multi-tab (≥6) checks from this pass. The F3 limits in About and IMPLEMENTATION.md describe browser behaviour I have not measured here.
- Polling windows see changes up to 3 s late. A window focused in the last 20 s still holds a stream, so several quickly alternated windows can briefly hold several streams.
- Owner review depends on the owner. An action whose owner has left stays on hold until someone takes ownership (only possible if there is no owner) or a new action is created. The 20-review cap also fails closed.
- The AI-assisted label is self-declared by design (F7). Authorship is not verified.
- The archive budget and global rate limits are fixed-window local limits. They are not abuse-grade.
- Implicit form submission on Enter with a hidden default button varies slightly by browser. Either way the dialog stays correct, because step 1 submission is treated as Next.

## Earlier self-review (first build), still accurate

- The server is authoritative, and clients cache only public state. Events carry only revision numbers.
- The AI bridge sits behind an injectable runner, so tests never spawn the CLI.
- Tokens are compared by `Map` lookup, not in constant time. That is acceptable on loopback, but not in production.
- The first build had already fixed two bugs: closed dialogs are always removed, and `<select>` values are set after the options exist.
