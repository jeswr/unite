# Verification of the everyday-life revision

27 September 2026. Research, coordination and acceptance checks by Codex. Application and test changes by the user's requested Claude Opus 5.5, including a separate review session. This record supplements the author's [implementation report](../../prototype-v4/LIFE-FIRST-IMPLEMENTATION.md) and [review](../../prototype-v4/REVIEW-LIFE-FIRST.md).

## Model and cost

Three Claude Code CLI sessions completed successfully with `--model claude-opus-5-5`. Each result reported only `claude-opus-5-5` in `modelUsage` and `is_error: false`.

| Session | CLI-reported estimated cost (USD) |
|---|---:|
| Implementation | 4.8159068 |
| Separate review and fixes | 1.6544616 |
| Browser findings and final fixes | 0.6641998 |
| Total | **7.1345682** |

This is the CLI's API-equivalent estimate, not audited billing. It excludes Codex research and coordination and the two runtime AI calls below. No new subscription or purchase was made. Session result files remain outside the repository; no credentials or private interview records were committed.

## Automated checks

Codex independently ran `node --test --test-reporter=spec tests/*.test.js` in `prototype-v4/` after the final fixes: **91 tests across 26 suites; 91 pass, 0 fail, 0 skipped, 0 cancelled**. The suite includes browser-module syntax and existing security checks. `git diff --check` was clean. No dependencies were added.

Relevant checks cover optional intended-outcome fields, validation and bounds, public state and export, prompt requirements, old route handling, draft preservation and the null-child rendering regression. Prompt assertions establish the instructions sent to the model; they do not establish interview quality or political neutrality.

## Browser acceptance

Used the Codex in-app browser against an isolated local server on port 8770. Synthetic identities and content were used. The isolated server was stopped and its browser tab closed after checking:

- The revised home invitation, ordinary-life room names and fictional sample labels.
- All four moments in the imagined day, including access needs, chosen craft and unresolved quiet/music differences. Current capabilities and proposed capabilities are visibly separated.
- A neutral, initially empty response composer; unsent text and the chosen room survive Cancel and reopening.
- Joining, creating an action, retaining optional intended-outcome fields through Back/Next, and showing these as intentions rather than measured results.
- Literal `<b>` text remains text in an action's intended change.
- Legacy employment-model links show an honest historical notice.
- A 390 × 844 mobile viewport with no horizontal body overflow (document width 375). Navigation can scroll horizontally. The temporary viewport override was reset.
- The browser-discovered `nullnull` defect was corrected by Claude. Rechecked the action dialog both with zero concerns and after adding a synthetic concern: no literal null text, and the concern and its explanatory text remain visible.
- No captured browser console warnings or errors during the final isolated checks.

The revised user-facing server was restarted on **http://127.0.0.1:8769/** with AI enabled and the exact model configured. Reloading the existing user tab showed the new home, room names and sample posts. The tab was then opened to **http://127.0.0.1:8769/#/futures**, where the new day example was visibly verified. A screenshot was saved outside the repository. Public data was exported before restarting; that export contained no non-sample posts or actions. The historical prototype and unrelated checkout were left alone.

The server remains an interactive local process, not an installed background service. Public state is in memory and is lost on restart; this is disclosed in the interface.

## Two real AI calls with synthetic input

After explicitly giving the demo's AI consent in the isolated test tab, submitted a fictional account asking for more income to make things with a daughter, with a step-free route, flexibility on difficult days, and a wish not to be assigned work or told a cure was necessary.

The interviewer reflected those stated wishes and boundaries, then asked what an unhurried moment making things together would look and feel like. It did not prescribe a political or economic model. A subsequent AI-drafted public post retained the income framing, step-free access, flexibility and the two boundaries. The draft remained in the review dialog and **was not published**. Both responses passed the application's model-verification check before display.

The synthetic conversation was cleared through the interface and AI consent withdrawn. No user health details were submitted. This was one bounded conversational example and a draft check, not evidence of representative performance, cultural validity or absence of bias. The follow-up asked two closely related things within a single turn; the check does not establish a strict one-question-per-turn property.

## Remaining limits

This revision changes the entry point, the envisioned outcome and the link from actions to everyday intentions. It does not yet implement participant-confirmed structured needs, comparison of alternative arrangements, resource matching, allocation, shared ownership, cross-community federation or measurement of lived outcomes. It remains an English-language local demonstration with one server and one AI provider.

Known interface limits from the review remain recorded there, including retained hidden interview history after withdrawing consent and cancellation of edits to an AI-generated draft. No representative user study, accessibility certification, global feasibility claim or demonstration of post-scarcity coordination is implied.
