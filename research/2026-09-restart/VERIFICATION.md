# Verification and provenance

26 September 2026. This is the final acceptance record for this research iteration, including browser checks performed after the engineering notes were written.

## Who did what

Codex researched the operating proposal, wrote the briefs and templates, orchestrated the work, and performed browser acceptance. **Claude Opus 5.5 authored all application code and tests, conducted the separate engineering review, and made every code fix.** The Claude CLI JSON results for the build, review, review fixes and final UI correction all identify `claude-opus-5-5` in `modelUsage` and report no execution error. Raw CLI records are kept locally outside the repository; they are not needed to run the demo.

The changes are isolated to `prototype-v3/` and this research directory. The earlier application is preserved. This is a new product exploration, not a completed performance or dependency audit of the old application.

## Automated checks

The final code passed `node --test tests/*.test.js` from `prototype-v3/`: **41 passed, 0 failed, 0 skipped**. Claude also ran `node --check` on all ten application modules and all five test files. There are no third-party package dependencies or installation step.

The tests cover private/public separation, export/import consistency, malformed input, preserved concerns, decision and funding requirements, delivery transitions, storage failure and recovery, and withdrawal of linked inspirations. They also document a security boundary: without signatures, a consistent alteration of both a concern and its decision attachment cannot be detected. These are bounded invariant tests, not evidence of production security or democratic legitimacy.

## Browser acceptance

Completed in the Codex in-app browser against a local HTTP server:

- Saved a private aspiration and verified that its private-only text was absent from the community view and public export.
- Created a separate shared copy through the confirmation dialog; the personal protection field was blank by default. The final dialog explicitly displayed the copied topic, time horizon and inspiration reference.
- Added a concern and an expert question and found both in the unresolved record before decision-making.
- Checked required decision-field errors, then recorded a simulated decision with a named owner, reasons, date, budget allocation and four attached concerns.
- Reopened the public JSON in the reader: the decision and concerns survived, and the private note remained absent. Repeated the valid round trip after the review fixes.
- Removed one attached concern from a test JSON record: the final reader rejected it with a specific error.
- Confirmed the distinction between budget allocation and actual confirmation of funds, and the initially collapsed demo explanation.
- Inspected desktop and 390-pixel phone layouts; the tested phone viewport had no horizontal overflow. This was a layout check, not a full accessibility audit.
- Retested sharing and reset after the final count fix: the status changed from six to seven descriptions when shared and back to six after reset, matching the cards. All synthetic test entries were removed before handover.

## Review findings resolved

A separate Claude review found that withdrawing a referenced inspiration could break export and cause destructive recovery on reload. Claude repaired the references, preserved unrelated records and decisions, and added regression coverage. It also fixed inconsistent concern attachments, decision/commitment/trail relationships, attribution and disclosure validation, and impossible calendar dates. Browser acceptance found ambiguous funding wording and a stale Explore count, both corrected by Claude.

## Limits and next gate

The demo uses fictional participants, experts, budgets and commitments. It is browser-local, with plaintext local storage, no authenticated identities, live expert routing, AI service, Solid/ActivityPub integration, representative voting, real funding or public deployment. The reader shares the application's code; it is not an independently maintained implementation. No screen-reader audit, broad browser matrix, penetration test or live participant study was performed.

No potential partner or funder was contacted, and no grant application was submitted. A real pilot still needs an accountable convenor and decision owner, a signed process charter, resources, participant recruitment and support, privacy/security work, and an evaluation protocol. The research's budget and participation targets are planning hypotheses.
