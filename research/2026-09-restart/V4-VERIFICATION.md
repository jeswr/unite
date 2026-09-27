# Conversational Unite: verification and provenance

26 September 2026. **Complete for the local prototype scope:** review corrections and final browser acceptance passed.

## Engineering provenance

All application code, tests, engineering review and corrections in `prototype-v4/` were assigned to the user's requested **Claude Opus 5.5** through the installed Claude Code CLI. The initial build, independent backend review, correction pass and final copy correction all returned `is_error: false` with `modelUsage` containing only `claude-opus-5-5`. Codex wrote research and product direction, orchestrated the work and performed browser acceptance; it did not author application code or tests.

The initial build is commit `60a6fb8`. The earlier application and `prototype-v3/` are preserved. Separate storage/origins prevent relabeling or deleting v3 data.

## Automated verification

Codex ran the initial Claude-authored suite using `node --test --test-reporter=spec tests/*.test.js`: **61 tests passed, zero failed, skipped or cancelled**. Coverage includes ownership and session validation, hostile HTTP inputs, exact CLI flags/model verification, simulated subprocess errors/timeouts/cancellation, private-data exclusion, live events/reconnection, versioned stances and action snapshots. Fake runners are used for automated AI tests; they make no real model calls.

After the independent review and browser findings were corrected, Codex ran the same command on the functional revision: **83 tests passed, zero failed, skipped or cancelled**. The added tests cover material-context reviews and concurrency, institutional proposal/adoption separation, concern-history caps, time zones, aggregate limits and caching, connection-policy behavior with stand-in browser objects, and honest AI attribution. A final one-sentence financing clarification was then syntax-checked by Claude; the full suite was not repeated for that copy-only change. See [engineering review](../../prototype-v4/REVIEW.md) for the implemented rules and limitations.

The CLI reports API-equivalent usage costs of **$8.05** for the build, **$1.08** for the independent backend review, **$6.65** for review corrections and **$0.17** for the final copy clarification: approximately **$15.95 total**, calculated from the unrounded records. These are CLI estimates, not audited account charges. They exclude Codex's research/orchestration and the three actual browser AI calls. No subscription or credits were purchased. This supports keeping software implementation budgets small while accounting separately for participation and real-world delivery.

## Browser observations completed before the correction pass

Codex used the actual local app through the Codex in-app browser, with two distinct per-tab participants named Demo tester A and Demo tester B. All entered content was synthetic acceptance data.

- A post from A appeared in B's open page, and a reply from B appeared in A's page. An unsent draft in B survived the live update.
- Room-specific counts showed one support and one concern from the two participants, with the concern text visible and no sample votes.
- An opt-in **actual Claude interview call** returned a contextual follow-up to a synthetic answer. The bridge's exact-model validation succeeded. This was not the labeled static opening question.
- Publishing an edited excerpt through the explicit review dialog placed only that excerpt in the feed. The private marker in the interview answer was absent from the public feed.
- An **actual Claude synthesis call** returned a private suggestion with source-post links and unresolved differences. It did not automatically alter the shared statement or create votes.
- Editing and adopting that suggestion as version 2 reset current responses to zero and preserved the previous version's one support and one concern in history.
- The futures view offered all three models, everyday scenarios, trade-offs and a staged transition path. Content corrections were requested so the global-employer model allowed constitutional local autonomy and did not misattribute a precise economic model to the founder.
- The phone feed at 390×844 had no horizontal document overflow. A compactness improvement was requested because setup/navigation occupied too much of the first viewport.
- Neither browser tab recorded a warning or error in the inspected console logs.

Browser acceptance caught a CSS defect: elements marked hidden remained displayed, exposing both action-dialog steps. It also caught a privacy-cleanup defect: clearing the interview removed the main transcript but left an earlier AI reply in a screen-reader announcement. These were sent to Claude for correction, alongside the independent backend findings about readiness, institutional adoption and connection limits.

## Final browser acceptance after corrections

The local server was restarted with the reviewed implementation. Two new synthetic participants exercised the final flows:

- An additional actual Claude interview call succeeded. Clearing it removed both the private marker and the returned AI text from the entire rendered document, including the live announcement. Consent was withdrawn afterwards.
- A new public post and changing room concerns appeared across tabs. Live updates preserved an unsent owner-review draft.
- The action dialog showed only step 1, then only step 2. Every element marked hidden had computed display `none`; the institutional field appeared only when that scope was selected.
- An action created with an unresolved room concern could not advance. A recorded owner review enabled Ready. Rewording the concern in the other tab held the next transition and required a fresh review. The earlier reason and concern remained visible.
- An institutional proposal progressed through Ready, Doing and Done. Its final status explicitly read **“Proposal work completed; institutional adoption unconfirmed.”** Naming the fictional council never created authority or adoption.
- A new statement version reset support/concern counts to zero. An existing action retained its earlier snapshot and flagged that its owner had reviewed version 1 while the room was now on version 2.
- The revised global-employer scenario included constitutional local/worker autonomy, portable rights and independent protections as possibilities, alongside its coordination, financing and concentration risks. It remained open to agreement or critique.
- At **390×844**, a fresh feed load showed the first conversation in the viewport. The feed and futures comparison had equal document client/scroll widths (390px), with no horizontal document overflow. The normal viewport was restored.
- The inspected browser consoles remained free of warnings and errors.

Six simultaneous real browser tabs were **not** tested. The connection-limit policy was tested with stand-in objects, and actual acceptance used two tabs. Unfocused windows can receive updates through polling up to about three seconds later. No broad audit is implied.

## Honest scope

The preview is local to this computer. Live means actual server updates between connected tabs, not a public audience or fabricated activity. Sample people are fictional; local session counts do not establish unique humans, representation or consensus outside the demo. The UI is in English, and no broad accessibility, screen-reader, cross-browser, security or multilingual audit is claimed.

The server keeps public data in memory and loses it on restart. A public-only export is available; there is no import or production backup. Private interviews live in the participant tab and are sent to Anthropic only through the disclosed opt-in flow. The server is launched with AI enabled for this local preview, but each tab must still consent before making a request; normal launches leave AI off. Calls use the existing Claude account and may consume its credits or usage limits. No new credentials or subscriptions were created.

There is no deployed federation, institutional adoption, payment, public mandate or verified completion of real-world work. No outside person or institution was contacted and no grant was submitted. Production requirements are listed in the [implementation report](../../prototype-v4/IMPLEMENTATION.md).
