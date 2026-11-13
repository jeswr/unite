# Unite redesign: build specification

Version 1, 13 November 2026. This is the contract for the first build. The design it implements is
in `DESIGN.md` beside this file. Where this spec and the design differ, this spec wins for the
build and the difference is a bug in one of them: report it.

Implementers: build exactly what is here. If something is ambiguous, take the more conservative
reading, finish, and list the question in your report. Do not add features, pages, dependencies or
abstractions that are not named here.

## 1. Product rules that code must enforce

These are the rules that make Unite different from the four earlier attempts. Each has a test.

1. **Heard alone first.** A person cannot fetch an assembly's picture, statements, reactions,
   reasons, rooms or priorities until they have a completed conversation in that assembly (or,
   for an example assembly, have explicitly chosen "Look around the example first", which is
   recorded and shown). Hosts and stewards are exempt. The server enforces this, not the client.
2. **Only approved points leave a conversation.** Transcripts are readable only by their owner.
   No endpoint returns another person's turns.
3. **Every summary sentence has sources.** A theme sentence or statement with no existing source
   point is rejected at write time.
4. **Counts are computed by code** from stored records, as numbers of people.
5. **Others' answers are hidden until you answer.** A statement's reaction totals are returned to
   a participant only after that participant has reacted to it.
6. **No pledge, no assembly.** An assembly cannot leave stage `proposed` without a complete pledge.
7. **The host cannot mark its own work done.** Only a check (by the check panel or the named
   independent body, acting as steward or checker role) can set a `delivered_*` or
   `not_delivered` status.
8. **Nothing is ranked by attention.** No like counts, no view counts, no trending. Lists are
   ordered by time, by the proportional rule in section 8, or alphabetically.
9. **The interviewer never argues.** Every interviewer reply passes `validateInterviewerReply`
   before it is stored or shown.
10. **Example data is labelled.** Every page of an assembly with `isExample: true` shows the
    example banner.

## 2. Stack and layout

Mirror Concord (`/home/claude/standards-concord/standards-concord`, read-only reference:
`apps/server/src/{app,db,config,vercel}.ts`, `apps/server/src/llm/`, `apps/web/`).

- Node 22, pnpm workspace, TypeScript strict, ESM (`"type": "module"`).
- `redesign/packages/shared`: zod schemas, TypeScript types, pure functions (ids, counting,
  opinion groups, proportional ranking, decision rule, interviewer validation). No I/O.
- `redesign/apps/server`: Express 5, zod 4, `@anthropic-ai/sdk`, `@electric-sql/pglite`, `pg`,
  `cookie-parser`, `express-rate-limit`, `tsx`, `vitest`, `supertest`.
- `redesign/apps/web`: React 19, Vite, Tailwind 4, React Router 7, `vitest` +
  `@testing-library/react`. No UI kit, no state library, no chart library.
- `redesign/e2e`: Playwright (the pre-installed one; do not run `playwright install`).
- Scripts at `redesign/package.json`: `dev` (server on 4310, web on 4311 with `/api` proxied),
  `build`, `test`, `typecheck`, `lint` (eslint flat config, typescript-eslint recommended),
  `seed`, `e2e`.
- Production: the server serves `apps/web/dist` and the API from one process (`pnpm start`).
  A Vercel entry (`apps/server/src/vercel.ts`, `redesign/vercel.json`) mirrors Concord's.
  Do not deploy.

Environment variables (all optional; document them in `redesign/README.md` and `.env.example`):

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | unset | Enables the Claude interviewer and synthesis. Unset means scripted mode |
| `UNITE_MODEL` | `claude-opus-5-5` | Model for every AI call |
| `UNITE_AI_DAILY_USD` / `UNITE_AI_MONTHLY_USD` | `5` / `40` | Spending caps. Over the cap means scripted mode |
| `DATABASE_URL` | unset | Postgres. Unset means PGlite at `UNITE_DATA_DIR` (default `redesign/.data`), or in memory when `UNITE_DATA_DIR=memory` |
| `UNITE_SECRET` | dev value | Signs the session cookie. Required in production |
| `UNITE_HOST_CODE` / `UNITE_STEWARD_CODE` | `host` / `steward` in dev; required in production | Passcodes for the host and steward consoles |
| `UNITE_DEMO` | `1` in dev | Seeds the examples on an empty store and shows the role switcher |
| `UNITE_NOW` | unset | Fixed clock (ISO date-time) for tests and the video |

## 3. Design language

Plain, quiet and readable. This is not a dashboard.

- White page, near-black text (`#111`), one accent (`#1f4fd8`) for actions and links. Meaning
  colours only where they carry meaning: agree `#1a7f4b`, disagree `#b3261e`, unsure `#8a6d00`,
  late or warning `#b3261e`. All text meets WCAG AA.
- System sans-serif stack led by Helvetica Neue, Helvetica, Arial. Base size 18px, line height
  1.55. Reading column max 44rem. Corners 4px. Hairline borders, no shadows, no gradients.
- Phone first. Every page works at 375px with no sideways scroll. Check at 375, 768 and 1280.
- One primary action per screen. The message box in a conversation is always visible without
  scrolling (fixed to the bottom of the viewport on phones).
- Plain British English. Short sentences. No jargon: never show ids, levels as numbers without
  words, "T1", "pod", "node", "cluster" or "LLM" to participants. Use the product words:
  conversation, point, picture, statement, room, assembly, host, pledge, decision, register.
- Every page has a visible "Give feedback" button (bottom right on desktop, in the footer bar
  on phones) and, on example assemblies, the example banner.
- Accessibility: semantic headings in order, labelled controls, focus moves to the main heading
  on navigation, `aria-live="polite"` for new interviewer turns and room messages, respects
  `prefers-reduced-motion`.

## 4. Data model

All records are stored as JSON documents in one table:
`docs(collection text, id text, data jsonb, created_at timestamptz, updated_at timestamptz,
primary key (collection, id))`, with a GIN index on `data`. `Store` interface:
`get(collection, id)`, `put(collection, doc)`, `list(collection, where?: Record<string, string |
number | boolean>, opts?: {orderBy?: 'created_at' | 'updated_at', dir?, limit?})`,
`delete(collection, id)`, `transaction(fn)`. Two implementations share one SQL dialect: PGlite
and `pg`. Every write validates the document against its zod schema.

Ids are `<prefix>_<12 url-safe chars>`. Timestamps are ISO strings from the injectable clock.

All schemas live in `packages/shared/src/schemas.ts` and are the single source of types.

```ts
// People and access
Person { id: per_, createdAt, displayName?: string, isExample: boolean,
         about: Record<string, string>,          // answers to an assembly's aboutQuestions, by key
         locale: string }                         // BCP 47, default 'en-GB'
Membership { id: mem_, personId, assemblyId,
             role: 'participant' | 'host' | 'steward' | 'checker',
             invited: boolean,                    // joined with a valid invite code: counts toward decisions
             lookedAroundFirst: boolean,          // rule 1 exception, example assemblies only
             joinedAt }
Invite { id: inv_, assemblyId, code: string, label: string, createdAt, uses: number }

// Assemblies
Assembly { id: asm_, slug, title, question, summary,
           kind: 'listening' | 'advisory' | 'codecided' | 'community' | 'technology',
           scale: 'local' | 'sector' | 'global' | 'platform',
           hostName, hostSlug, hostDescription,
           stage: 'proposed' | 'pledged' | 'listening' | 'picture' | 'deliberating' | 'deciding'
                | 'answered' | 'delivering' | 'checked' | 'review',
           isExample: boolean, isOpenListening: boolean,
           probes: string[],                      // at most 3, each passed the leading-wording check
           aboutQuestions: { key, label, options: string[] }[],
           affectedGroups: { key, label, aboutKey, aboutValue, target: number }[],
           pledge: Pledge | null,
           pictureConfirmedAt?: string, pictureConfirmedBy?: string,
           createdAt, updatedAt, version: number } // version increments on any change under the assembly
Pledge { setAside, remit, offTable,
         decisionLevel: 0 | 1 | 2 | 3,
         groupThreshold: number,                  // share of each opinion group that must agree, e.g. 0.6
         minParticipants: number,
         capacity: number,                        // how many priorities the host will answer
         replyBy: string,                         // ISO date
         checkBody: 'panel' | 'independent', checkBodyName?: string,
         reviewAfterDays: number,
         publishedAt?: string, challengeEndsAt?: string }

// Conversations
Conversation { id: con_, personId, assemblyId,
               route: 'ai' | 'questions' | 'freetext' | 'host',
               mode: 'claude' | 'scripted', modelId?: string, promptVersion: string,
               language: string,
               stage: 0..9, stageTurns: number,
               status: 'active' | 'reviewing' | 'complete' | 'abandoned',
               consent: { conversation: boolean, at: string },
               exit?: { soundsLikeMe: 1 | 2 | 3 | 4, pushed: 'no' | 'a_little' | 'yes', note?: string },
               startedAt, completedAt? }
Turn { id: trn_, conversationId, role: 'interviewer' | 'person', text, stage: number, createdAt,
       meta?: { regenerated?: number, fallback?: boolean } }
Point { id: pt_, conversationId, personId, assemblyId,
        type: 'moment' | 'matters' | 'barrier' | 'wish' | 'idea' | 'tradeoff' | 'doubt',
        text,                                     // the person's approved wording, original language
        textEn?: string,                          // English rendering when the original is not English
        draftText: string, sourceTurnIds: string[],
        status: 'draft' | 'approved' | 'scrapped' | 'withdrawn',
        visibility: 'count' | 'anonymous' | 'named',
        themeId?: string, approvedAt? }

// Picture
Theme { id: thm_, assemblyId, kind: 'matters' | 'barrier' | 'idea' | 'day',
        name,                                     // participants' words
        sentences: { text: string, pointIds: string[] }[],
        pointIds: string[], updatedAt }           // people count is computed, never stored
Report { id: rpt_, assemblyId, targetType: 'theme' | 'statement' | 'decision', targetId,
         kind: 'missing' | 'added' | 'emphasis' | 'count' | 'other', text, personId?: string,
         status: 'open' | 'upheld' | 'not_upheld', outcomeNote?: string, createdAt, resolvedAt? }

// Statements
Statement { id: st_, assemblyId, text, version: number, previousId?: string,
            themeIds: string[], pointIds: string[],
            origin: 'ai' | 'reword' | 'room' | 'steward', authorPersonId?: string,
            status: 'candidate' | 'common_ground' | 'differ' | 'not_enough' | 'decided'
                  | 'no_agreement' | 'retired',
            createdAt, updatedAt }
Reaction { id: rx_, statementId, assemblyId, personId, value: 'agree' | 'disagree' | 'unsure',
           counted: boolean, createdAt }          // one per person per statement; upsert
Reason { id: rsn_, statementId, assemblyId, personId, side: 'for' | 'against' | 'question',
         text, createdAt }                        // max 280 characters
Objection { id: obj_, statementId, assemblyId, personId, text,
            status: 'open' | 'answered' | 'sustained' | 'withdrawn',
            reply?: string, repliedBy?: string, createdAt, resolvedAt? }

// Rooms
EvidenceCard { id: evd_, assemblyId, question, answer, sources: { title, url }[],
               confidence: 'low' | 'medium' | 'high', disputed?: string, expertName, expertRole }
Room { id: room_, assemblyId, statementId?: string, topic,
       briefing: { summary, forSide: string[], againstSide: string[], evidenceIds: string[] },
       status: 'scheduled' | 'open' | 'closed', memberIds: string[], minutes: number,
       startedAt?, endsAt?,
       outcome?: { reasonsFor: string[], reasonsAgainst: string[], proposedWording?: string,
                   questionsForExperts: string[] } }
RoomMessage { id: msg_, roomId, authorType: 'person' | 'facilitator' | 'system', personId?: string,
              text, createdAt }
RoomAnswer { id: ra_, roomId, personId, value: 'agree' | 'disagree' | 'unsure', note?: string }

// Deciding and delivering
PriorityChoice { id: pc_, assemblyId, personId, statementIds: string[], updatedAt } // at most 3
Decision { id: dec_, assemblyId, statementId, number: number,   // shown as "Decision 3"
           title, why, options: string[], dissent,
           tests: { n: number, text: string }[],
           delivery: ('technology' | 'social')[],
           rank: number, dueDate: string, reviewDate: string,
           status: 'awaiting_answer' | 'accepted' | 'changed' | 'delayed' | 'refused'
                 | 'in_progress' | 'delivered_as_decided' | 'delivered_minor_changes'
                 | 'delivered_substantial_changes' | 'not_delivered' | 'replaced',
           answer?: { kind: 'accepted' | 'changed' | 'delayed' | 'refused', reasons: string,
                      changedTo?: string, delayedUntil?: string, answeredAt, answeredBy },
           createdAt, updatedAt }
BuildProposal { id: prop_, decisionId, assemblyId, proposerName, proposerRole, summary, plan,
                cost?: string, testCoverage: { n: number, how: string }[],
                status: 'proposed' | 'chosen' | 'not_chosen', faithfulConfirmedAt?: string }
DeliveryItem { id: dlv_, decisionId, assemblyId, title, kind: 'technology' | 'social', owner,
               dueDate, status: 'planned' | 'in_progress' | 'done', link?: string,
               updates: { at: string, text: string }[] }
Check { id: chk_, decisionId, assemblyId, checkBody: string, panel: string[],
        results: { n: number, met: boolean, note: string }[],
        classification: 'as_decided' | 'minor_changes' | 'substantial_changes' | 'not_delivered',
        summary, checkedAt }

// Feedback on Unite
Feedback { id: fb_, token: string, personId?: string, path: string,
           mode: 'guided' | 'free' | 'changes',
           messages: { role: 'interviewer' | 'person', text: string }[],
           answers: { key: string, question: string, answer: string }[],
           name?: string, contact?: string, screenshot?: string, // data URL, at most 400 KB
           status: 'draft' | 'received' | 'planned' | 'done' | 'declined', statusReason?: string,
           publicIssue: { state: 'none' | 'previewed' | 'agreed' | 'withdrawn', text?: string },
           sinceVersion?: string, createdAt, submittedAt? }
Spend { id: 'YYYY-MM-DD', usd: number, calls: number }
```

Releases are a checked-in file, `redesign/RELEASES.json`:
`{ version, date, changes: { text, affects: string[], question?: string }[] }[]`.

## 5. Pure functions in `packages/shared` (all unit-tested)

- `countPeople(points)`: distinct `personId` among approved points.
- `opinionGroups(reactions, statementIds)`: builds a person by statement matrix (agree 1,
  disagree -1, unsure or missing 0) over people with at least 3 reactions; k-means with k=2,
  deterministic seeding (farthest pair); if fewer than 8 such people or the two centroids differ
  by less than 0.5 mean absolute difference, return one group. Returns
  `{ groups: { key: 'a' | 'b', personIds }[] }`.
- `statementSupport(statement, reactions, groups)`: per group and overall
  `{ agree, disagree, unsure, total, share }`.
- `classifyStatement(support, pledge, counted)`: `common_ground` when every group's agree share
  is at least `pledge.groupThreshold` and each group has at least 3 reactions and overall counted
  reactions are at least `min(pledge.minParticipants, 10)`; `differ` when any group's agree share
  is below 0.4 while another's is at least `groupThreshold`; otherwise `not_enough`.
- `stillNeeded(statement, support, objections, pledge)`: an ordered list of plain-English
  requirements not yet met, for example "12 more people need to answer", "People who answered
  differently from the majority are below the level the pledge set (41% agree, 60% needed)",
  "1 objection is waiting for a reply". Empty list means the rule is met.
- `rankPriorities(choices, statementIds)`: sequential proportional approval voting. Repeatedly
  pick the statement with the highest score, where each person's choice is worth
  `1 / (1 + number of already-ranked statements that person chose)`. Ties break by earlier
  statement creation. Returns ordered ids with each round's score.
- `validateInterviewerReply(reply, stage)`: see section 6.
- `wordOverlap(a, b)`: share of content words of `a` found in `b` (lower-cased, punctuation and
  a small stop list removed).
- `registerSummary(decisions)`: counts by status, with `in_progress` never included in any
  "done" figure.

## 6. The AI layer (`apps/server/src/ai/`)

One file, `prompts.ts`, holds every prompt and `PROMPT_VERSION`. It is served at
`GET /api/how/prompts` and shown on `/how/prompts`.

Calls use the Anthropic TypeScript SDK exactly like this (no other shapes):

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
const client = new Anthropic();
const response = await client.messages.parse({
  model: config.model,                 // default "claude-opus-5-5"; never add a date suffix
  max_tokens: 16000,
  output_config: { effort: "low", format: zodOutputFormat(Schema) }, // "medium" for synthesis
  system: PROMPT,
  messages,
});
if (response.stop_reason === "refusal" || !response.parsed_output) { /* use the scripted path */ }
```

Do not send `thinking`, `temperature`, `top_p`, `top_k`, `budget_tokens`, a forced `tool_choice`
or an assistant prefill: the default model rejects them. Catch errors with the SDK's typed
classes, most specific first (`Anthropic.RateLimitError`, `Anthropic.APIError`). Every AI call
goes through `withAi(name, fn, fallback)`, which checks the key and the caps, records estimated
spend from `response.usage` (input $4 and output $20 per million tokens), and returns the
fallback on any failure. Tests never call the network: `withAi` takes an injectable runner.

### 6.1 Interviewer

The stage machine is code. Stages:

| # | Key | Goal given to the model | Leaves when |
|---|---|---|---|
| 0 | welcome | Not an AI turn. The consent screen | Consent given |
| 1 | real_day | Get one real, recent, ordinary day described in episodes | 2 to 3 person turns |
| 2 | mattered | Pick one moment they mentioned; ask why it mattered, then why that matters | 2 to 3 |
| 3 | in_the_way | What they wanted to do and could not; what stops it | 2 to 3 |
| 4 | good_day | An ordinary good day a few years from now, walked through | 2 to 3 |
| 5 | circle | Who else must be all right for that day to be good; who might lose | 1 to 2 |
| 6 | tradeoff | Two things they said they want that pull against each other; which gives way and when | 1 to 2 |
| 7 | how | Their own ideas for what would help: a tool, rule, service, group or habit | 1 to 2 |
| 8 | unsure | What they are unsure of and what would change their mind | 1 to 2 |
| 9 | heard | Not an AI turn. Points review | Points approved |

A stage advances when the person has given the minimum turns and the model set
`stage_complete`, or at the maximum. "Skip this" from the person advances immediately. Inside an
assembly, the assembly's question is given to the model as the topic for stages 1 to 8, and the
host's probes are asked in stage 7, one per turn, before the stage can end.

Model output schema: `{ acknowledgement: string, question: string, stage_complete: boolean,
safety: 'ok' | 'distress' | 'identifying' }`. The shown text is the acknowledgement, a space,
and the question.

`validateInterviewerReply` fails a reply when any of these is true: `question` does not contain
exactly one question mark; the whole reply is over 70 words; it contains an evaluative or
steering phrase (case-insensitive list in `shared`: "great", "good point", "wonderful",
"I think", "I believe", "in my opinion", "you should", "have you considered", "many people",
"most people", "other people say", "others have said", "for example", "such as", "e.g.",
"studies show", "research shows", "the fact is"); it contains a URL or a number followed by a
percent sign. On failure the server asks once more with the failure named, then again, then
uses the scripted question for that stage and records `meta.fallback`.

The abstraction rule is in the prompt and has its own test: when the person's last turn uses a
general word (money, expensive, afford, the system, the government, the council, the economy,
society, capitalism, AI) without a concrete episode, the next question asks either for the last
time it got in their way or for what it would let them do, using their word unchanged.

`safety: 'distress'` ends the interview turn with a fixed, kind message that the conversation
can stop here, shows local help text from `prompts.ts` (generic, no phone numbers invented:
"If you are in danger or need urgent help, contact your local emergency number"), and offers to
continue or stop. `safety: 'identifying'` appends a fixed line asking the person not to share
names or addresses.

Scripted mode (`scripted.ts`): two fixed questions per stage (an opener and a follow-up), in
plain neutral wording, and a label on the conversation page: "This conversation uses fixed
questions. The AI interviewer is not switched on."

### 6.2 Points

`extractPoints(turns)` returns 3 to 7 points `{ type, text, sourceTurnIds }` built from the
person's own phrases. Each must have `wordOverlap(text, sourceTurns) >= 0.6`, at least one
source turn, and at most 30 words; failing points are dropped, and if fewer than 3 remain the
scripted extractor fills in. Scripted extractor: the person's first sentence of their longest
turn in stages 1, 2, 3, 4 and 7, typed moment, matters, barrier, wish and idea.

The person can edit a point's text freely (their words win, no overlap check), change its
visibility, scrap it, or add one of their own. Approving sets the conversation `complete` and
asks the two exit questions.

Other routes: `freetext` (one box; `extractPoints` runs on that single turn), `questions` (the
scripted questions shown as a plain form, one stage per screen), `host` (a host or steward
enters points on someone's behalf; the points stay `draft` until that person approves them with
a one-time link).

### 6.3 Synthesis

- `groupPoints(points)`: assigns each approved point to a theme of the same kind
  (`matters`, `barrier`, `idea`, and `day` for `moment` and `wish`), creating themes as needed,
  in batches of at most 100 points, naming each theme with a phrase taken from one of its points.
  Fallback: greedy clustering by `wordOverlap >= 0.34` within kind; the name is the shortest
  point.
- `describeTheme(theme, points)`: 1 to 3 sentences, each with `pointIds` drawn from the theme.
  Sentences whose ids do not all exist in the theme are dropped. Fallback: no sentences; the
  theme shows its quotes only.
- `draftStatements(themes, points)`: up to 12 candidate statements, each at most 30 words, each
  with source `pointIds`, written so that each of the largest themes of every kind has at least
  one. Fallback: none; a steward writes them.
- `reviseStatement(statement, rewordings, reasons)`: one revised wording with the same sources.
- `checkLeading(text)`: `{ leading: boolean, why: string, suggestion: string }` for host probes
  and assembly questions. Fallback: a phrase list ("don't you", "wouldn't you agree", "should we
  not", "obviously").

Synthesis runs when a steward or host presses "Update the picture", and automatically when an
assembly has 5 or more approved points not yet in a theme. Re-running never deletes a theme
that has reports or statements attached.

### 6.4 Facilitator

Code decides when the facilitator speaks; the model only words it. Triggers, checked on each
new room message and each 15 seconds of polling: room opened (welcome and the trade-off);
someone has not spoken after everyone else has spoken once (invite them by display name);
one person has more than 40% of the last 10 messages (thank them and ask to hear from others);
half time; five minutes left (ask for any new wording); time up (ask for private final
answers). Output is validated with the same banned-phrase list. Fixed fallback wording exists
for each trigger. The facilitator never summarises positions; the room's outcome is entered by
the members themselves at the end (each can add a reason for, a reason against, a wording, a
question for experts).

### 6.5 Feedback interviewer and host intake

Feedback: three modes. `guided` asks ten fixed topics in order (what you were trying to do,
what happened, what was confusing, whether the conversation sounded like you, whether the
picture matched what you said, whether you trust the summaries, what is missing, what you would
remove, would you take part in a real assembly and why, anything else), with at most one
follow-up each. `free` asks one open question and at most two follow-ups. `changes` lists the
changes since `sinceVersion` from `RELEASES.json` and asks each change's question if it has
one. System rule, verbatim: "Never argue with feedback or defend the product." Each answer is
stored in `answers` as the person's own words and shown in the answers panel, where it can be
edited. Scripted fallback: the fixed topic questions with no follow-ups.

Host intake: seven fixed questions that fill a draft pledge (what the question is, who is
affected, what you can act on, what you have set aside, what is off the table and why, how you
want it decided, when you will answer), each with one follow-up at most, then the draft pledge
form pre-filled for editing. The question and each probe run through `checkLeading`.

## 7. API

JSON over `/api`. A signed, http-only cookie `unite_sid` holds the person id; it is created on
the first write. Errors are `{ error: { code, message } }` with plain-English messages.
`express-rate-limit`: 60 writes a minute per session and per address in general; conversation
and feedback turns 20 a minute. Role checks: `host` and `steward` come from a second signed
cookie set by `POST /api/role` with the passcode; a checker is a participant listed on a check
panel.

Polling: `GET /api/assemblies/:slug/version` returns `{ version }`. The web client polls it
every 2 seconds on live pages and refetches when it changes. Rooms poll their own
`GET /api/rooms/:id/messages?after=<id>` every 1.5 seconds.

| Area | Endpoints |
|---|---|
| Session | `GET /api/me` (person, memberships, role, demo flag); `PATCH /api/me` (displayName, about, locale); `POST /api/role` `{ role, code }`; `DELETE /api/role`; `GET /api/me/export` (everything held about me); `DELETE /api/me` (erases the person, conversations, turns, points, reactions, reasons, choices; recomputes themes) |
| Assemblies | `GET /api/assemblies`; `GET /api/assemblies/:slug` (assembly, my membership, stage checklist from `stageChecklist()`, counts); `POST /api/assemblies/:slug/join` `{ inviteCode? , lookAroundFirst? }` |
| Conversations | `POST /api/conversations` `{ assemblySlug, route, language }`; `GET /api/conversations/:id` (owner only: conversation, turns, points); `POST /api/conversations/:id/consent`; `POST /api/conversations/:id/turns` `{ text }` or `{ skip: true }` returns the next interviewer turn or the move to review; `POST /api/conversations/:id/points` (add); `PATCH /api/points/:id` (text, visibility, status); `POST /api/conversations/:id/approve`; `POST /api/conversations/:id/exit` |
| Picture | `GET /api/assemblies/:slug/picture` (themes with people counts, sentences with sources, quotes limited to points with visibility `anonymous` or `named`, who is missing, totals, my own points marked); `GET /api/themes/:id/points`; `POST /api/assemblies/:slug/picture/update` (steward or host); `POST /api/assemblies/:slug/picture/confirm` (steward); `POST /api/reports`; `GET /api/assemblies/:slug/reports`; `PATCH /api/reports/:id` (steward) |
| Statements | `GET /api/assemblies/:slug/statements` (each with my reaction, and totals, support by group and `stillNeeded` only if I have reacted or am host or steward); `GET /api/statements/:id` (with sources, reasons in two columns by time, objections, versions); `POST /api/statements/:id/reactions`; `POST /api/statements/:id/rewordings` `{ text }` (creates a `reword` candidate with the same sources); `POST /api/statements/:id/reasons`; `POST /api/statements/:id/objections`; `PATCH /api/objections/:id` (steward: reply and status); `POST /api/assemblies/:slug/statements/draft` (steward: run `draftStatements`); `POST /api/assemblies/:slug/statements` (steward: write one, with source points); `POST /api/statements/:id/revise` (steward) |
| Rooms | `GET /api/assemblies/:slug/rooms`; `POST /api/assemblies/:slug/rooms` (steward or host: topic, statement, minutes; members drawn by lot from invited participants, balanced across opinion groups; `drawRoom()` is deterministic given a seed); `GET /api/rooms/:id`; `POST /api/rooms/:id/open`; `GET /api/rooms/:id/messages`; `POST /api/rooms/:id/messages`; `POST /api/rooms/:id/answer`; `POST /api/rooms/:id/outcome` (members add to the outcome); `POST /api/rooms/:id/close`; `GET /api/assemblies/:slug/evidence` |
| Deciding | `GET /api/assemblies/:slug/priorities` (ranked list with each round's score, my choices, how many people have chosen); `PUT /api/assemblies/:slug/priorities` `{ statementIds }`; `POST /api/assemblies/:slug/decide` (steward: turns the top `pledge.capacity` ranked `common_ground` statements into decisions with `awaiting_answer`, due on `pledge.replyBy`; the steward supplies each decision's tests, why, options and dissent in the request) ; `POST /api/assemblies/:slug/stage` (host or steward: move to the next stage; refused with the unmet checklist items unless `stageChecklist()` is clear) |
| Delivering | `GET /api/assemblies/:slug/decisions`; `GET /api/decisions/:id` (decision, statement, trace to themes and point counts, answer, proposals, delivery items, check); `POST /api/decisions/:id/answer` (host); `POST /api/decisions/:id/proposals`; `PATCH /api/proposals/:id` (host: choose; steward: confirm faithful); `POST /api/decisions/:id/delivery`; `PATCH /api/delivery/:id` (host: status, update); `POST /api/decisions/:id/check` (steward or checker only; sets the decision's `delivered_*` or `not_delivered` status) |
| Register | `GET /api/register?assembly=&host=&status=` (all decisions with assembly and host, days late where `awaiting_answer` is past due, `registerSummary`); `GET /api/hosts/:hostSlug` (host record: answered on time, accepted, changed, delayed, refused, delivered as decided, with changes, not delivered); `GET /api/me/trace` (each of my approved points with its theme, statements, decisions and current status) |
| Open listening | `GET /api/listening` (the open-listening picture, themes with no hosted assembly, good ordinary days) |
| Hosts | `POST /api/host/intake` and `POST /api/host/intake/:id/turns` (intake interview); `POST /api/host/assemblies` (create in `proposed`); `PATCH /api/host/assemblies/:slug` (question, probes, groups, pledge); `POST /api/host/assemblies/:slug/invites`; `POST /api/check-leading` |
| Feedback | `POST /api/feedback` `{ path, mode, sinceVersion? }` returns token and first question; `POST /api/feedback/:token/turns`; `PATCH /api/feedback/:token` (answers, name, contact, screenshot, publicIssue); `POST /api/feedback/:token/submit` (allowed with any number of answers); `GET /api/feedback/:token` (your feedback and its status); `GET /api/releases`; steward: `GET /api/steward/feedback` (list, counts, themes summary with sources), `PATCH /api/steward/feedback/:id` (status and reason), `GET /api/steward/feedback/export?format=json|csv` |
| How | `GET /api/how/prompts`; `GET /api/how/rules`; `GET /api/assemblies/:slug/export` (the pledge, picture, statements with support, decisions, register entries; no transcripts, no person ids) |
| Health | `GET /healthz` |

`stageChecklist(assembly)` returns, for the current stage, the plain-English conditions for
moving on and whether each is met:

| From | Conditions |
|---|---|
| proposed | Pledge complete; question and probes pass `checkLeading` |
| pledged | Challenge period has ended |
| listening | Completed conversations at least `minParticipants`; every affected group at least half its target |
| picture | A steward has confirmed the picture; no report is open |
| deliberating | At least one statement is common ground; every room is closed; no objection is open |
| deciding | Priorities chosen by at least half of invited participants, or `replyBy` minus 14 days has passed; decisions created |
| answered | Every decision has an answer |
| delivering | Every accepted or changed decision has a chosen plan and at least one delivery item |
| checked | Every accepted or changed decision has a check |

## 8. Web application

React Router routes. Page components live in `apps/web/src/pages/<area>/`. Shared pieces live in
`apps/web/src/ui/` (Button, Field, Card, Tag, Banner, StageTracker, StillNeeded, Sources,
PersonCount, EmptyState, Dialog, Tabs, Layout, FeedbackButton, ExampleBanner, RoleSwitcher) and
`apps/web/src/lib/` (`api.ts` typed fetch, `useLive(slug)` polling hook, `speech.ts`).

| Route | Area | What it shows |
|---|---|---|
| `/` | home | One sentence on what Unite is. "Start a conversation" (open listening). Open assemblies as cards: question, host, stage in words, "what happens to what you say". The loop in six words. No statistics wall |
| `/assemblies` | home | All assemblies, grouped by stage in words |
| `/a/:slug` | assembly | The question, host, the pledge in brief, the stage tracker (ten stages, current one expanded with its checklist), and the one action that fits me now (start my conversation, continue it, see the picture, react, join my room, choose priorities, read the answer) |
| `/a/:slug/pledge` | assembly | The full pledge in plain words, the rule explained in one paragraph, the reply date, the check body |
| `/talk`, `/a/:slug/talk` | talk | Route choice: talk with the AI interviewer (default), answer written questions, write freely. Language. Consent text. Starts a conversation |
| `/talk/:id` | talk | The conversation. Stage names along the top as words ("A real day", "What mattered", ...), interviewer and person turns, message box fixed at the bottom with a microphone button (browser speech recognition, hidden when unsupported), "Skip this", "Stop here and review". Shows the scripted-mode label when applicable |
| `/talk/:id/review` | talk | "Here is what I heard." Each point: text (editable), type in words, "from what you said" (opens the source turns), visibility choice, keep or scrap. Add a point. "These are right" approves. Then the two exit questions. Then a button to the picture |
| `/a/:slug/picture` | picture | Totals ("48 people have spoken"). Themes by kind in this order: what matters, what gets in the way, good ordinary days, ideas. Each theme: name, people count, sentences each with "sources" (opens quotes and count), up to three quotes, "this is not what was said". "Who we have not heard from". My own points are marked "you said this". Steward sees "Update the picture" and "Confirm the picture". Updates live |
| `/listening` | picture | The open-listening picture, "Themes with no host yet" with a "Host an assembly on this" link to the host console, and good ordinary days |
| `/a/:slug/statements` | statements | Statements to react to, one at a time first (agree, disagree, unsure, or "say it better"), then the full list in three groups: common ground, where we differ, not enough voices yet. Totals appear only on statements I have answered |
| `/a/:slug/statements/:id` | statements | The statement, its versions, what is still needed (plain words), support overall and for "people who answered like you" and "people who answered differently", sources, reasons for and against in two columns with a box to add one, objections with replies, "this is not what was said" |
| `/a/:slug/rooms` | rooms | My room if I have one, with its time; other rooms as closed summaries (reasons for, reasons against, new wording); evidence cards |
| `/a/:slug/rooms/:roomId` | rooms | The live room: briefing (both sides, evidence), messages, the facilitator's turns marked "Facilitator (AI)", a timer, the message box, then the private final answer and the outcome form |
| `/a/:slug/priorities` | deciding | Choose up to three common-ground statements. The live ranked list with a one-line explanation of the proportional rule. How many have chosen. The capacity line ("The host has pledged to answer the top 5") |
| `/a/:slug/decisions` | delivery | Decision cards: number, title, status in words and colour, due date or days late |
| `/a/:slug/decisions/:id` | delivery | The decision record: what, why, options, dissent, numbered tests, the trail back (statement, themes, how many people), the host's answer with reasons, proposals, delivery items with updates, the check with each test marked met or not met |
| `/register` | delivery | Every decision across assemblies. Filters: assembly, host, status. A summary line that never counts "in progress" as done |
| `/hosts/:hostSlug` | delivery | The host's record |
| `/me` | me | "What happened to what I said": each of my points with its trail and current status. My conversations. Download my data. Delete my data (with a clear confirmation) |
| `/host` | host | Passcode gate. My assemblies. "Open a new assembly" starts the intake interview, then the pledge editor. Per assembly: stage checklist and "move on", invitations, answer priorities, proposals, delivery items |
| `/steward` | steward | Passcode gate. Per assembly: update and confirm the picture, reports, objections, draft statements, draw rooms, create decisions, record checks. Feedback: list, counts, themes, export |
| `/feedback` | feedback | Three ways in. The chat with the answers panel beside it (below it on phones). Voice. "Submit what I have said so far". Optional name and contact, optional screenshot, optional agreement to a public summary shown exactly as it would be published. Ends with the private link to "your feedback" |
| `/feedback/:token` | feedback | Your feedback and its status with the reason |
| `/changes` | feedback | Releases and what changed |
| `/how`, `/how/rules`, `/how/prompts` | how | How Unite works in under 500 words with the loop; the rules; the published prompts with the model name and prompt version |

The public issue is prepared and previewed only. Nothing is sent to GitHub in this build; the
steward export includes the agreed text.

Role switcher: when the server reports `demo: true`, a small bar offers "View as participant,
host, steward". It calls `POST /api/role` with the dev passcodes. It is absent otherwise.

Example banner text: "Example. The people and the host in this assembly are invented so you can
see how Unite works."

## 9. Seed data (`apps/server/src/seed/`)

Runs when `UNITE_DEMO=1` and the store is empty, and through `pnpm seed`. Seed writes documents
through the store with fixed ids and the fixed clock so it is reproducible. All seeded people
have `isExample: true` and invented first names from many backgrounds. Text must read like real
speech: concrete, uneven, in the speaker's own register, never like a policy paper. No real
organisations, no real people.

Reference date for the seed: 13 November 2026.

1. **`open` — "The lives people want"** (open listening; `isOpenListening`, kind `listening`,
   scale `global`, stage `listening`, no host, `isExample: true`). 60 people across at least 14
   countries, each with 3 to 5 points; at least 20 people's points are in a language other than
   English (with `textEn`), covering at least 6 languages. Themes of every kind. At least four
   themes have no hosted assembly, including care for ageing parents while working, and safe
   streets for children. About questions: region, age band.
2. **`earning-and-learning` — "What would let people here keep earning and keep learning as work
   changes?"** Host "Riverbend Council and Riverbend College" (invented town), kind `codecided`,
   scale `local`, stage `deciding`. Pledge: £250,000 of the 2027–28 adult skills budget and the
   college's evening and weekend timetable set aside; remit is adult learning, council childcare
   hours and the council's own apprenticeships; off the table are wages at private employers and
   national benefit rules, with the reason that neither host controls them; level 2;
   `groupThreshold` 0.6; `minParticipants` 40; capacity 5; reply by 18 December 2026; check body
   `panel`; review after 365 days. 48 invited participants with completed conversations.
   Affected groups: shift workers, parents and carers, under 25, over 50, out of work, local
   employers. Under 25s are under-heard (3 of a target of 10). Themes include: courses run when
   I am at work or asleep; I cannot stop earning to learn; I do not know what will still be a
   job; being good at something people need; time with my family; learning with other people and
   not alone on a screen; childcare during classes; what I already know does not count.
   Statements (exact wording):
   - S1 "People who work nights or rotating shifts should be able to take any core course at a
     time that fits their shift." Common ground.
   - S2 "Nobody should have to lose pay to retrain for a job that is disappearing." Where we
     differ. A closed room worked on it; its outcome proposed S2b.
   - S2b "Workers in roles their employer expects to change should get paid learning hours, with
     the cost shared between the employer and the skills fund." Version 2 of S2. Common ground.
   - S3 "Skills people already have from work and from caring should count toward a
     qualification without sitting the course again." Common ground.
   - S4 "The college should teach in workplaces and community halls, and not only on campus."
     Common ground.
   - S5 "Everyone should be taught to use AI tools as a basic skill, like reading." Where we
     differ, with reasons on both sides.
   - S6 "Childcare should be available during any funded class." Common ground.
   - S7 "Courses should be chosen by what local employers say they need." Where we differ.
   - S8 "People under 25 should help choose what the college teaches." Not enough voices yet.
   Reactions give two opinion groups. One open room is scheduled on S5 for the video, with six
   members and two evidence cards. Priority choices exist for 31 people; S1, S2b, S6, S3 and S4
   rank in that order. One objection on S4 is answered; one report on a theme was upheld.
   No decisions yet.
3. **`volunteering-tool` — "What should a shared volunteering tool do for volunteers and the
   groups they help?"** Host "Northern Volunteer Centres Network" (invented), kind `technology`,
   scale `sector`, stage `delivering`. 36 participants. Pledge: a build budget, a named product
   owner, level 2, capacity 5, reply date in the past and met. Five decisions:
   - Decision 1 "A volunteer proves who they are once and can share that proof with any group
     they choose." Tests: (1) a volunteer checked by one group can start with a second group
     without a new identity check; (2) the volunteer can see which groups have looked at their
     record; (3) the volunteer can withdraw a group's access at any time. Accepted. A chosen
     build proposal, three delivery items done, a check by a panel of five:
     `delivered_minor_changes` (test 2 met for groups but not yet for individual staff).
   - Decision 2 "Hours given are recorded by the volunteer, confirmed by the group, and belong
     to the volunteer." Accepted, `in_progress`, two delivery items.
   - Decision 3 "A group with no paid staff can start using it in ten minutes without training."
     Changed: phone version first, desktop later, with reasons. `in_progress`.
   - Decision 4 "The tool works in Welsh, Urdu and Polish from the first release." Delayed until
     a stated date, with reasons.
   - Decision 5 "The network pays volunteers' travel costs through the tool." Refused, with
     reasons: no budget line and outside the pledge's remit, and a note of what the host will do
     instead (publish each group's travel policy in the tool).
   The delivery notes mention that the data standard for volunteering records is governed in
   Concord.
4. **`ai-and-care` — "In looking after people, what should AI do and what should stay with
   humans?"** Host "Care Futures Coalition" (invented: care workers' unions, providers and
   family carer groups in six countries), kind `advisory`, scale `global`, stage `pledged`,
   challenge period open for 9 more days, affected groups by region with targets, no
   conversations yet, three probes. It links back to the open-listening theme that prompted it.
5. **`making-unite-better` — "What would make Unite work better for you?"** Host "The Unite
   maintainers", kind `advisory`, scale `platform`, stage `proposed`, `isExample: false`, with a
   draft pledge marked "Draft. Not yet confirmed by the maintainers." No people, no points.

`RELEASES.json` starts with version 0.1.0 dated 13 November 2026 listing what this build
contains, each change with who it affects, three of them with a question for testers.

## 10. Tests and gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all pass with no warnings treated as
  acceptable.
- Unit tests for every function in section 5 and every validator in section 6.
- Server tests with `supertest` on an in-memory store and a fake AI runner, including one test
  for each numbered rule in section 1, the stage machine, conversation privacy, data export and
  deletion, the decision checklist, and the register never counting `in_progress` as done.
- Web tests for the conversation page, points review, a statement card hiding totals until
  answered, and the feedback chat.
- Playwright: one journey test per area against the seeded demo in scripted mode, each taking
  screenshots at 375, 768 and 1280 wide into `redesign/e2e/shots/` (git-ignored), and asserting
  no horizontal overflow and no console errors.
- Conventional Commits, small. No model names or identifiers in commits, comments or docs,
  except `claude-opus-5-5` as the configured default model id where the code needs it.

## 11. Out of scope for this build

Sign-in providers, email or SMS, real identity checks, spoken rooms, scheduled mass sessions,
posting to GitHub, coding agents building decisions, translation of the interface, level 4
decisions, multi-operator federation, Solid, payments, analytics, cookies beyond the two
described.

## 12. Deliberating in your own time

Added after the first build. Section 1's rules apply unchanged; two are widened here and each
widening has a test.

- Rule 2 also covers mediations: no endpoint returns another person's mediation turns or drafts.
- Rule 5 also covers slow rooms: a member of a slow room sees other members' messages only after
  posting one of their own.
- Rule 8 also covers the reasons a mediation shows: they are chosen by arrival order and distinct
  author, never by any count.
- Rule 9 also covers the mediator: every mediator reply passes `validateInterviewerReply`.

### 12.1 Talk it through (collection `mediations`, id prefix `med`)

A private conversation between one person and the AI about one statement. The step machine is
code; the model only words the question, and fixed questions are used when the AI is off or its
reply fails the check three times (the page then says so, as the interview does).

```
Mediation {
  id, assemblyId, statementId, personId,
  status: 'active' | 'reviewing' | 'complete' | 'abandoned',
  step: 1 | 2 | 3 | 4,                     // why, other_side, wording, question
  answer: 'agree' | 'disagree' | 'unsure', // the person's answer when it started
  turns: { role: 'mediator' | 'person', step, text, createdAt, fallback?, skipped? }[],
  shownReasonIds: string[],                // chosen by code at step 2
  drafts: { reason?, reasonSide?: 'for' | 'against', wording?, question? },
  approved?: { reasonId?, questionId?, statementId? },
  aiUsed: boolean, startedAt, updatedAt, completedAt?
}
```

Who may start one: a person who is heard in the assembly (rule 1) and has answered the statement
(409 `answer_first` otherwise: "Answer the statement first, then talk it through."). The
statement must not be `retired` or `decided`. One mediation per person per statement; starting
again returns the existing one.

| Step | Key | What the mediator is asked to do | Person turns |
|---|---|---|---|
| 1 | why | Ask what is behind their answer, and for a time it mattered in their own life | 1 to 2 |
| 2 | other_side | Code shows up to three reasons from people who answered differently. Ask what is true in them and what they leave out | 1 to 2 |
| 3 | wording | Ask whether there is a wording they could agree with that the others might too, in their own words | 1 to 2 |
| 4 | question | Ask what they would want checked or answered before deciding | 1 |

Choosing the reasons for step 2 (`pickOtherSide`, pure, in `packages/shared`): from the
statement's reasons with side `for` or `against`, take those on the side opposite the person's
answer (`agree` sees `against`, `disagree` sees `for`, `unsure` sees both), drop the person's
own, keep the earliest reason of each author, and return the first three by `createdAt` (for
`unsure`, the first two of each side). When there are none, step 2 is skipped and a fixed line
says nobody who answered differently has given a reason yet. The reasons are rendered by code
as quotations under the heading "Reasons from people who answered differently". They are never
passed to the model as text to repeat, and the model's reply is still checked.

"Skip this" advances a step. "Stop here and review" goes to the review at once. A person turn
is at most 1,200 characters. `safety` works as in the interview.

Review ("Here is what I heard"): `extractMediation` (AI, effort low) returns
`{ reason, wording, question }`, each either null or text whose words overlap the person's own
turns (`wordOverlap` at the same threshold as points; a field that fails is replaced by the
fallback). The fallback uses the person's own words: the first unskipped step 1 turn as the
reason, the last unskipped step 3 turn as the wording, the step 4 turn as the question, each
trimmed to the field's limit, and nothing for a step that was skipped or answered with only
"no", "none" or "nothing". The reason's side defaults from the answer (`agree` to `for`,
`disagree` to `against`) and must be chosen by the person when the answer was `unsure`. The
person can edit or scrap each item. Approving creates, through the same service functions as
the direct routes: a reason with the chosen side, a reason with side `question`, and a
rewording (a candidate statement with `origin: 'reword'`, the same wording check as the direct
route). Approving with everything scrapped is allowed and creates nothing.

API (all bodies and views in `packages/shared/src/api/mediation.ts`):
- `POST /api/statements/:id/mediations` starts or returns mine.
- `GET /api/mediations/:id` (owner only, 403 otherwise).
- `POST /api/mediations/:id/turns` with `{ text }`, `{ skip: true }` or `{ stop: true }`.
- `PATCH /api/mediations/:id/drafts` with any of `reason`, `reasonSide`, `wording`, `question`
  (an empty string scraps the item).
- `POST /api/mediations/:id/approve`.
- `GET /api/statements/:id` gains `mediation: { mine?: { id, status }, completed: number }`,
  where `completed` is the number of people who have finished one, counted by code.
- `GET /api/me/export` includes my mediations and `DELETE /api/me` removes them.

Web: `/a/:slug/statements/:id/talk`. The statement page shows a "Talk it through" card once the
person has answered, with one sentence on what it is and how long it takes; it is placed above
the reasons when the statement's status is `differ`. The page follows the conversation page:
one question at a time, the quotations shown as a quiet block, the fixed-questions notice, the
review as cards with a side choice, then a short thank-you that links back to the statement.

Prompts: `MEDIATOR_SYSTEM`, `MEDIATOR_FIXED` (two fixed questions per step) and
`MEDIATION_EXTRACT_SYSTEM` in `prompts.ts`, published on the prompts page like the others.

### 12.2 Slow rooms

`Room` gains `pace?: 'live' | 'slow'` (absent means live). A slow room's length is still held in
`minutes` (days times 1,440); the create form asks for 2 to 14 days, default 5.

- Write before you read: `GET /api/rooms/:id/messages` for a member of a slow room who has not
  posted returns only facilitator and system messages, with `mustWriteFirst: true` and
  `hiddenCount` (the number of person messages held back). After their first message they get
  everything.
- Triggers by pace (pure, tested): the wording phase starts when a fifth of the time is left
  (live rooms keep five minutes); "make room" fires at most once every six hours; a silent
  member is invited only once 24 hours have passed since the room opened. Half time and time up
  are unchanged.
- Fixed wording for a slow room is in `FACILITATOR_FALLBACK_SLOW`; the model is told the pace and
  the time left in words. `timeLeftWords(ms)` in `packages/shared` gives "3 days left",
  "5 hours left", "20 minutes left".
- The room page says "This is a slow room. It is open until {date}. Write when you can, and come
  back to read the others." and shows the write-first notice with the hidden count. The rooms
  list labels each room live or slow.
- Everything else is as for a live room: the draw, the briefing, one unclosed room per person,
  the private final answer, the outcome, closing.

### 12.3 Seed and tests

- Riverbend: four completed mediations on the statement about AI tools whose `approved.reasonId`
  point at reasons already in the seed (so no public record changes), and one open slow room on
  a statement that is not common ground, drawn from people who are in no other unclosed room.
  The scheduled room on the AI-tools statement must stay exactly as it is: the video opens it.
- Journeys: `e2e/journeys/talk-it-through.spec.ts` (answer, talk it through on fixed questions,
  approve, see the reason on the statement, and a second person cannot open the first one's
  mediation) and `e2e/journeys/slow-room.spec.ts` (a steward opens a slow room; a member sees
  the write-first notice, writes, then sees the others).

