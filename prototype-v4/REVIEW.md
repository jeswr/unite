# v4 self-review (five axes)

A self-review by the author (Claude Opus 5.5), not an independent audit.

## Correctness
- The core rules sit in `server/store.js` and are tested directly and over
  HTTP: ownership, one stance per participant, revision resets with
  history, snapshots and staleness, status transitions, and holds for open
  concerns.
- **Fixed during review:** closed dialogs could stay in the DOM when the
  `close` event was not delivered, so later automation or keyboard use
  could answer an old dialog. Removal is now explicit, and all close paths
  share one callback, which also restores focus to the opener.
- **Fixed during review:** `h()` set `value` before children existed,
  which would not select an option on a `<select>`. The value is now set
  after the children.
- **Open risk:** model verification assumes `modelUsage` keys exactly
  equal `claude-opus-5-5`. If the real CLI reports otherwise, AI fails
  closed with a message naming the reported model. The root's real call
  will settle this.
- **Nit:** in step 1 of the action dialog, pressing Enter does nothing; it
  does not advance to step 2.

## Readability
- The server is 10 small modules; `store.js` (654 lines) is the
  largest because it holds every domain rule in one place.
- The client is plain ES modules with one view per file; the largest view
  is `act.js` (242 lines).
- **Consider:** `ui.js` (379 lines) mixes shared components and four
  dialogs. It could be split if it grows further.

## Architecture
- The server is authoritative, and clients hold only a cache of public
  state. Live events carry revision numbers, not data, which keeps the
  events private and makes reconnect trivial. The cost is one state
  refetch per change per tab, which is fine at local scale.
- The AI bridge is behind an injectable runner, so tests never spawn the
  CLI.

## Security
- The review confirmed: loopback bind; Host, Origin, Sec-Fetch-Site and
  custom-header checks; strict body allow-lists; no HTML sinks; a CSP
  without inline code; tokens absent from public output; no logging of
  bodies; a shell-free spawn with fixed arguments and stdin-only input;
  bounded stdout.
- **FYI:** the SSE and state endpoints are readable without a session by
  design (public data), and so by any local process.
- **FYI:** tokens are compared by `Map` lookup, not in constant time. That
  is acceptable for a loopback demo, but not for production.

## Performance
- `publicState()` is rebuilt for each request and the coverage calculation
  scans all posts. That is O(posts) and trivial under the 2,000-post cap.
  Each tab re-renders its whole view on each change; drafts and focus are
  preserved.
