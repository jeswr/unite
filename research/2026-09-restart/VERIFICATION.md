# Verification and provenance

26 September 2026. This is the final acceptance record for the worldwide-futures revision, including browser checks performed alongside and after the engineering work. Earlier acceptance checks are retained where the behavior still applies.

## Who did what

Codex researched the operating proposal, wrote the briefs and templates, orchestrated the work, and performed browser acceptance. **Claude Opus 5.5 authored all application code and tests, conducted the separate engineering review, and made every code fix and the worldwide-futures revision.** The Claude CLI JSON results for the build, review, review fixes, final UI correction and global revision all identify `claude-opus-5-5` in `modelUsage` and report no execution error. Raw CLI records are kept locally outside the repository; they are not needed to run the demo.

The changes are isolated to `prototype-v3/` and this research directory. The earlier application is preserved. This is a new product exploration, not a completed performance or dependency audit of the old application.

## Automated checks

The final code passed `node --test tests/*.test.js` from `prototype-v3/`: **45 passed, 0 failed, 0 skipped**. Claude also ran `node --check` on all ten application modules and all five test files. There are no third-party package dependencies or installation step.

The tests cover private/public separation, export/import consistency, malformed input, preserved concerns, decision and funding requirements, delivery transitions, storage failure and recovery, and withdrawal of linked inspirations. They also document a security boundary: without signatures, a consistent alteration of both a concern and its decision attachment cannot be detected. These are bounded invariant tests, not evidence of production security or democratic legitimacy.

The global revision adds checks for the new example's funding remit and $2,000 limit, explicit USD currency, rejection of older exports, and preservation of older browser data. The new context uses separate storage keys and export schema version 2. Reset affects only the current example; previous data is retained but this version provides no viewer or export for it.

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

Additional acceptance for the worldwide-futures revision:

- Verified the global homepage, six everyday-life topics, and the learning-opportunities example's clearly limited authority. A text scan found no former technical-ecosystem content or obsolete development budgets in the current prototype and research pack.
- Saved a housing/belonging aspiration, shared a reviewed copy and confirmed that the private marker remained absent from export and reader output.
- Added a concern about fixed meeting times. Attempting to allocate money to the paid-learning-time recommendation was rejected with an explanation about institutional authority. Recording a $2,000 community experiment succeeded with all four concerns attached.
- Reopened the version 2 public export: USD amounts, the shared aspiration, decision and concern were retained. A record marked version 1 was rejected explicitly rather than converted.
- Inspected the revised 390-pixel phone layout and confirmed no horizontal overflow. Restored the desktop viewport and cleared only the synthetic current-example entries; six fictional descriptions and no private drafts remained.

## Review findings resolved

A separate Claude review found that withdrawing a referenced inspiration could break export and cause destructive recovery on reload. Claude repaired the references, preserved unrelated records and decisions, and added regression coverage. It also fixed inconsistent concern attachments, decision/commitment/trail relationships, attribution and disclosure validation, and impossible calendar dates. Browser acceptance found ambiguous funding wording and a stale Explore count, both corrected by Claude.

## Limits and next gate

The demo uses fictional participants, experts, budgets and commitments. It is browser-local, with plaintext local storage, no authenticated identities, live expert routing, AI service, federation, representative voting, real funding or public deployment. The reader shares the application's code; it is not an independently maintained implementation. No screen-reader audit, broad browser matrix, penetration test or live participant study was performed.

No potential partner or funder was contacted, and no grant application was submitted. Open futures exploration can begin without a sponsor. A process promising formal decisions or delivery still needs accountable owners, a process charter, resources, participant support, privacy/security work and evaluation. The revised $12,000 learning-cycle budget and $100 implementation-credit allowance are planning hypotheses. The approximately $10 initial credit expense is supplied by the user, not independently audited billing.
