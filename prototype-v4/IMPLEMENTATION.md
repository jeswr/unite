# Unite prototype v4: implementation notes

Unite v4 is a conversational social app. People talk about humanity's
shared future in topic rooms, can talk privately with an AI interviewer,
find proposed common ground, and turn it into small next steps. It
replaces the form-heavy v3. v3 and all historical apps and data are
untouched, and v4 never reads, copies or deletes v3 `localStorage`.

This is a **real local multi-tab collaboration prototype**, not a deployed
service. A Node server on `127.0.0.1` holds the public state in memory and
pushes changes live to every tab on this computer. Each browser tab is its
own participant. All sample people are fictional. There are no partners,
no budget and no public mandate.

## Run and test

Node 20 or later. There are no dependencies and no install step. From
`prototype-v4/`:

```sh
node server/main.js                          # AI off (default): http://127.0.0.1:8769/
UNITE_AI=claude-cli node server/main.js      # AI on, via the installed Claude Code CLI
npm test                                     # = node --test "tests/*.test.js"
```

Options, all read only at launch:

| Variable | Meaning |
|---|---|
| `UNITE_PORT` | Port (default `8769`). The server always binds to `127.0.0.1` only. |
| `UNITE_AI=claude-cli` | Enables the AI bridge. Any other value, or no value, leaves it off. |
| `UNITE_CLAUDE_BIN` | Absolute path to the CLI if `claude` is not on `PATH` (for example `/Users/jesght/.local/bin/claude`). |

To take part as several people, open more tabs or windows on the same
computer. Each tab joins with its own display name.

## What works

### Conversations (main view)
- Four rooms: Work & time, Care, Climate & living places, Our shared future.
  There is an all-rooms feed and a feed per room, both newest first.
- Short posts (up to 1,200 characters) and one level of replies. Search
  covers post text and author names. Filters: room, and everyone, people
  here, samples only or my posts. Relative times are shown with a
  `<time>` element.
- Nine fictional sample posts (eight threads plus one reply), with
  different views: a shift worker wary of workfare, a baker worried about
  being crowded out, a retired teacher, an unpaid carer, a disabled person
  wary of "everybody contributes", a flood-hit farmer, a renter in a hot
  flat, a supporter of global coordination and a market-plus-safety-net
  sceptic. Each is labelled "Sample · fictional" and shows "written for
  this demo" instead of a time.
- Joining asks only for a display name. A short `#code` from the opaque
  participant ID tells apart people who choose the same name. Authors can
  withdraw their own posts. Replies stay; the withdrawn post shows
  "Withdrawn by its author".
- New posts, replies, stances, revisions and actions reach every connected
  tab through server-sent events. A status indicator shows Live,
  Reconnecting… or Server unreachable. Drafts, focus, cursor position and
  open `<details>` survive live re-renders.
- There are no likes, reaction counts, follower counts, presence, typing
  indicators or ranking algorithm, and no activity is scripted over time.

### Talk with Unite (private AI interview)
- A labelled fixed opening question ("written by the demo, not the AI"),
  then real Claude replies, one question at a time. The fixed system prompt
  covers life now, the future wanted, values, constraints, trade-offs,
  possible contribution (never required) and what would change their mind.
  It must not advocate any economic model or claim consensus.
- The consent disclosure is shown before anything is sent. Messages go
  through this local server to Anthropic, using this computer's Claude
  account, and may use credits. The server does not save or log them.
  Private text is never in the feed, summaries or export. Consent is kept
  per tab, can be withdrawn, and every request carries `consent: true`.
- Busy state, Stop (aborts the fetch, and the server kills the CLI
  process), a 120 s server timeout, Try again after a failure, and Clear
  conversation.
- The conversation lives in this tab's memory and `sessionStorage`
  (`unite.v4.interview`). The server is stateless for it: each turn sends
  the bounded transcript.
- "Draft a post with AI" or "Start from my last answer" opens a review
  dialog. The participant edits the text, picks a room and explicitly
  presses Publish.
- If AI is off or the CLI is missing, the view says so and shows the exact
  reason. Nothing imitates a reply.

### Common ground (per room)
- The current versioned statement, its unresolved differences, and links
  to its source posts. Withdrawn sources show as withdrawn.
- Support, concern (a reason is required) or abstain. There is one current
  stance per participant, and it can be changed. Tallies show only local
  respondents. Coverage shows respondents out of people who joined, how many
  have not responded, and how many people who posted in the room have not
  responded. The text says the numbers describe nobody outside the demo.
  Concerns are listed first, with names and reasons.
- Seeded starting drafts are labelled "Sample starting draft" and start
  with **zero** stances.
- Anyone who has joined can propose a new version, with its text,
  differences and chosen source posts. The previous version closes with its
  final tally and every response, including concern reasons, and moves to
  "Earlier versions". Responses on the new version start from zero.
  Requests carry `expectedVersion`, so a stance or action aimed at text
  that has since changed is refused (409) rather than applied to the new
  text.
- "Ask AI to suggest a synthesis" sends only the room's public posts and
  its current statement. Sample posts are marked as fictional; display
  names are not sent. The result is a private suggestion shown only in the
  requesting tab: statement, differences, cited posts, and a count of
  citations that matched no post. It changes no shared state. "Edit and
  propose" opens the normal editor. Once proposed, the version is labelled
  "Drafted with AI help", with the human as proposer.

### Act next
- "Turn this into an action" works from any room's current statement, even
  while concerns remain; those concerns are recorded with the action. A
  two-step dialog asks:
  1. Title, first step, owner (me, or needs a volunteer), check-in date.
  2. Scope (community experiment or institutional proposal, with the
     institution's name), then an optional rights, access or dependency
     concern, *then* impact, urgency and effort (1 to 3 each).
- The server snapshots the statement version, text, differences, tally
  and concern reasons. Priority = impact + urgency + (4 − effort), a whole
  number from 3 to 9, is computed on the server and explained on every
  card and in "How priority is computed". Viewers can order by priority,
  needs attention, urgency, impact, least effort, soonest check-in or
  newest, and filter by room and scope.
- Every card shows readiness before its score: open concerns, a missing
  owner, concerns recorded at creation, stale context, and, for
  institutional proposals, "Needs adoption by X. Not adopted: … naming an
  institution gives no authority."
- Stale context is computed at read time. It is flagged when the room's
  statement has been revised or the responses to that version have
  changed since creation.
- Statuses are proposed, ready, doing and done. Only the owner moves them,
  one step at a time, and stepping back is always allowed. Moving forward
  is blocked while any concern is open. Anyone may record how a concern
  will be handled, which lets the action move again. Only the person who
  raised a concern may reopen it. Concerns are never deleted, and their
  history is kept. Participants can volunteer or stop volunteering, and
  can take ownership when there is no owner. Owners and volunteers can
  update the next step; the history is kept.
- No money, payment, funding or authority is modelled anywhere.

### Possible futures
- Three models: a universal public-service economy (many democratic
  employers, local autonomy), labelled "Founder's proposal"; one global
  public employer; and a mixed economy with stronger guarantees and
  cooperatives. Each has an illustrative fictional "ordinary day",
  strengths, risks and a staged migration path. There is also a comparison
  table.
- Commitments every model must keep: freedom to choose work, to reject a
  model and to dissent; and care, study, rest, illness and disability
  without compulsory work.
- The illustrative path runs: discuss → voluntary paid community work →
  procurement and participatory budgets → public and cooperative
  institutions → wider democratic guarantees → negotiated international
  coordination. It is explicitly neither inevitable nor fiscally proven.
- Ostrom, Preston and Mondragon are presented as partial precedents, each
  with a caveat.
- "Post agreement", "Post a critique" and "Ask a question" publish a post
  labelled with the model and the kind of response (validated enums on the
  server).

### About
One compact persistent notice appears on every page. The About view covers
what is real and what is not, data and restart loss, tokens and display
names, AI disclosure, the design evidence (with caveats), and **Download
public data (JSON)** (`/api/export`).

## Architecture

| Path | Role |
|---|---|
| `server/main.js` | Launch: env parsing, loopback bind, clean shutdown (removes the AI scratch directory) |
| `server/app.js` | HTTP routing, Host/Origin/CSRF checks, session resolution, rate limits, AI endpoints |
| `server/http.js` | Security headers and CSP, bounded JSON reader, in-memory static file allow-list |
| `server/store.js` | In-memory public state and every domain rule; `publicState()` and `publicExport()` allow-list output |
| `server/validate.js` | Strict field/text/enum/int/date validators (unknown fields rejected) |
| `server/sessions.js` | Opaque per-tab tokens (32 random bytes) and a fixed-window rate limiter |
| `server/events.js` | SSE hub: revision-only frames, connection cap, heartbeat |
| `server/ai.js` | Claude Code CLI bridge: fixed args, spawn runner, output bounds, model verification |
| `server/prompts.js` | Fixed system prompts, prompt builders, interview validation, synthesis parsing |
| `server/seed.js` | Rooms, fictional sample posts and sample starting drafts |
| `public/index.html`, `public/css/app.css` | Shell (skip link, sidebar nav, demo notice, `<main>`), styling |
| `public/js/app.js` | Router, live refresh, re-render that preserves drafts and focus |
| `public/js/api.js`, `aiclient.js`, `dom.js`, `ui.js` | Fetch/SSE, AI consent, text-only DOM builder, shared dialogs |
| `public/js/views/*.js` | feed, talk, ground, act, futures, about |
| `tests/*.test.js` | `node:test` suites |

Live updates carry only `{rev, bootId, kind}`. A tab refetches
`/api/state` when the revision moves. On every (re)connect the server
first sends the current revision, so a tab that missed events catches up.
A changed `bootId` tells the tab the server restarted.

## Security and privacy invariants

- **Loopback only.** `listen(port, '127.0.0.1')`. There is no LAN or
  public binding, no proxy endpoint and no shell endpoint.
- **Host check on every request** (`127.0.0.1:port` or `localhost:port`,
  otherwise 421), as a DNS-rebinding defence. A request whose `Origin`
  names any other site is refused. `/api/*` also refuses cross-site
  `Sec-Fetch-Site`. No CORS headers are ever sent.
- **Mutations** need a matching `Origin`, `X-Unite-Client: 1` (which forces
  a preflight the server never approves), `Content-Type: application/json`
  and, except for joining, a valid `X-Unite-Session` token. Bodies are
  capped (16 KB, or 96 KB for the interview). Unknown fields, including
  `__proto__`, `authorId`, `priority` and vote counts, are rejected. Text is
  NFC-normalised and length-limited; control and bidi-override characters
  are rejected.
- **The server decides** IDs, authors, timestamps, snapshots, versions and
  priority. `expectedVersion` is only a concurrency check.
- **Static files** come from an allow-list read into memory at start-up,
  so there is no filesystem path at request time.
- **Output.** The browser builds DOM only from text nodes and attributes.
  A test fails if `innerHTML`-style sinks, `eval`, inline handlers or
  inline styles appear. CSP: `default-src 'self'`, no inline script or
  style, `connect-src 'self'`, `frame-ancestors 'none'`, `object-src
  'none'`, `base-uri 'none'`. Also sent: `nosniff`, `no-referrer`, COOP,
  CORP and `X-Frame-Options`.
- **No leaks.** Tokens live only in the sessions map and the tab's
  `sessionStorage`. Public state, events and exports are built by
  allow-list and never include tokens or interview text. The server logs
  only its start-up lines and the class name of unexpected errors, never
  request bodies. CLI stderr is drained and discarded.
- **Bounds.** 64 SSE connections, 500 participants, 1,000 sessions (12 h
  idle expiry), 2,000 posts, 200 actions, 50 versions per room, and caps on
  sources, differences, concerns, updates and volunteers. Rate limits: 20
  joins per minute; 60 writes per minute per participant; 20 AI requests
  per 10 minutes per participant; one AI request at a time per
  participant; two at a time for the server.

## AI bridge (Claude Code CLI)

- It is off unless the server was launched with `UNITE_AI=claude-cli`. At
  start-up it only checks that the executable exists; it never runs it.
  Loading the app or receiving live events never triggers an AI call. Only
  an explicit participant action does, and it carries consent.
- Command: `spawn(<claude>, args, { shell: false })`, with a fixed argument
  array:
  `--print --safe-mode --tools "" --strict-mcp-config --no-session-persistence --disable-slash-commands --model claude-opus-5-5 --max-budget-usd 0.50 --output-format json --system-prompt <fixed>`.
  Participant text goes only on stdin, wrapped in a labelled data block;
  any closing tag inside it is defused. The working directory is an empty
  scratch directory under the OS temp directory, outside the repository.
  The child inherits the environment, so the CLI's existing login keeps
  working, minus `CLAUDECODE` and `CLAUDE_CODE_ENTRYPOINT`, which would
  make it think it is nested. There is no `--bare` (which would disable
  OAuth), no bypass permissions and no fallback model.
- Output: stdout is capped at 256 KB (the process is killed beyond that)
  and the answer at 6,000 characters. The result must be `type: result`,
  `subtype: success` and not `is_error`, and **every key of `modelUsage`
  must equal `claude-opus-5-5`**; otherwise it is discarded with a
  truthful error naming the reported model. Timeouts, a missing CLI,
  non-zero exits, budget stops and malformed synthesis JSON each map to
  their own message. Nothing canned is ever substituted.
- The `--max-budget-usd 0.50` per-call cap is a cost guard of my own
  choosing.
- **Assumption to verify in the root's real call:** the JSON result
  reports `modelUsage` keyed by the exact model ID. If the CLI reports a
  suffixed ID, or an extra helper model, calls will fail closed with
  "reported model X instead of claude-opus-5-5". The check is in
  `parseCliResult` in `server/ai.js`.
- For production: a proper provider API with per-tenant keys, quotas,
  abuse controls and a data-processing agreement, not one person's CLI
  login.

## Verification actually performed

- `npm test`: **61 tests in 17 suites, all passing** (Node 25.1.0).
  - `store.test.js` (23): samples carry no stances; server-side
    authorship; withdraw-by-author-only; reply depth and room; limits,
    control and bidi characters; markup stored literally; future-model
    enums; one changeable stance per participant; concern reasons;
    version conflicts; coverage; revision resets responses and keeps
    history and concern reasons; source validation; the AI-assisted
    label; action snapshot; server priority and rejection of a
    client-supplied `priority`; staleness after new concerns and after a
    revision; outdated-version refusal; institution rules; check-in
    dates; owner-only single-step transitions held by open concerns;
    concern reopen rights and history; volunteer and next-step rights;
    the export notice has no tokens.
  - `http.test.js` (13): CSP and headers; exact static list and traversal
    attempts; bad Host, Origin and cross-site fetches; the Origin,
    client-header and JSON requirements; invalid and absent sessions;
    413, malformed JSON, `__proto__` and unknown fields; ownership over
    HTTP; two participants' stances; the write rate limit; tokens absent
    from state and export; SSE broadcast to two streams with
    revision-only payloads; the current revision on reconnect; the SSE
    connection cap.
  - `ai.test.js` (20): flags present and forbidden flags absent; text only
    on stdin; env scrubbing; model verification (other, extra or
    unreported model); error, budget, empty, oversize and unreadable
    results; outcome mapping; disabled or missing CLI runs nothing;
    concurrency; the **real spawn runner against Node stand-in scripts**
    for stdin passthrough without a shell, timeout kill, output overflow,
    abort, non-zero exit and spawn failure; interview validation; prompt
    fencing; synthesis parsing; endpoints with a fake runner (private
    text absent from state and export, consent and session required,
    disabled reported truthfully, synthesis leaves shared state unchanged
    and excludes display names, one request per participant).
  - `client.test.js` (5): every browser module parses; imports resolve;
    no HTML sinks, inline handlers or remote assets; time and excerpt
    helpers.
  - No test starts the real Claude CLI or makes any Anthropic call.
- **Headless Chromium smoke check (scratch script, not in the repo).** I
  drove the locally installed Playwright Chromium through the DevTools
  protocol against an in-process server with a *fake* AI runner, with two
  tabs (1280 px and 390 px mobile emulation). 25 checks passed with no
  page exceptions, console errors or CSP violations:
  - joining; a post from tab A appearing live in tab B as literal text;
    a live reply; A keeping its half-typed draft and focus during a live
    update; search;
  - stances and a stance change without duplicates; a private AI
    suggestion visible only in A; proposing it as version 2, seen live in
    B with responses reset, history kept and the AI label shown;
  - creating an action with an access concern, shown first on the card;
  - an interview turn stored in `sessionStorage`; an AI draft opening in
    the review dialog, published, and present in the export while the
    private answer is absent;
  - the futures and about views.

  This run found and fixed one real bug: closed dialogs were not always
  removed (the `close` event was not delivered in a background tab), so
  later dialogs could be answered twice. Screenshots were reviewed at both
  widths. **This is not the full browser acceptance.** Real-browser
  keyboard and screen-reader testing, Escape handling and the real AI
  call remain for root. Port 8769 was already in use on this machine
  during the build, so I did not start `server/main.js` on it.

## Product decisions

- **Talk first, then decide what to share.** Following Anthropic's
  interview study design (fixed aims, adaptive follow-ups), the interview
  is private. Only text the participant reviews and publishes becomes
  public. The study covered self-selected Claude users, so nothing here
  claims representativeness.
- **Chronological, no reward signals.** This responds to evidence that
  reward feedback and out-group content amplify outrage (Brady et al.
  2021; Rathje et al. 2021). It is a design bet, not a cure.
- **AI synthesis is a private suggestion with sources.** It needs a human
  proposer, and responses start again on every revision. Tessler et al.
  (2024) is read as a reason for contestation, not as a mandate.
- **Readiness before score.** A concern holds an action back until someone
  records how it is handled, but it is not a permanent veto. Only the
  person who raised it can reopen it.
- **Samples have no time and no votes.** Showing "3 h ago" on invented
  posts would suggest fake activity.
- **No money or authority modelled.** The board describes volunteers' own
  next steps. Institutional items always say adoption is not recorded.

## Limitations and data-loss notes

- **All public data is lost when the server stops.** Export first. There is
  no import.
- Participants are counted from the moment they join and never expire, so
  "have not responded" includes people who have closed their tab. A
  closed tab loses its token; that person cannot edit or withdraw their
  earlier posts and must join again as a new participant.
- Display names are live labels. Renaming changes the name on earlier
  posts, while action snapshots keep the name as it was.
- Anyone on this computer who can reach `127.0.0.1:8769` (other local
  users or processes) can read public data and join. There is no real
  authentication, moderation, blocking or reporting.
- `sessionStorage` survives a reload of the same tab, and browsers may
  write it to disk for session restore. The interview is therefore
  "tab-scoped", not "never on disk".
- The whole interview transcript is re-sent on each turn (up to 40
  messages and 30,000 characters). This costs more tokens as the
  conversation grows.
- The rate limiter is an in-memory fixed window, not abuse-grade.
- English (en-GB) only. No automated accessibility audit or screen-reader
  testing has been done. The `<search>` element needs a recent browser.
- Relative times and default check-in dates use the device clock.

## Still needed for production

A hosted service with durable, access-controlled storage and backups;
real identity and eligibility design (not display names); moderation,
reporting and safety tooling; a data-protection assessment (posts and
interviews can reveal health, politics, religion and migration status);
a provider API with tenancy, quotas and retention settings instead of a
local CLI; deliberate recruitment and facilitation wherever
representativeness or legitimacy is claimed; agreements with any
institution before its name appears as an adopter; translation,
low-bandwidth and assisted participation; accessibility audits; and
independent evaluation of outcomes beyond apparent agreement.
