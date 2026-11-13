# Unite: the redesign

13 November 2026

## The short version

**Unite is a place where people say, in a private conversation, what a good ordinary life looks like for them, see an honest picture of what everyone else said, work through the real disagreements together, decide by a rule agreed in advance, and then watch what was decided get built or get a public reason why not.**

The earlier attempts all stopped at the first or second step. They collected opinions, or simulated collecting them, and had nobody on the other end who had promised to act. This redesign starts from the other end. Nothing is asked of people unless a named host has already committed time, money or authority to respond.

Seven changes matter most.

|  | Before | Now |
| --- | --- | --- |
| 1 | A dashboard, a form or a feed is the first thing you meet | A conversation is the first thing you meet. An AI interviewer asks about a real day in your life, one question at a time |
| 2 | You pick from a list of needs, or split your own story into parts | You talk. The sorting into needs, barriers and ideas happens afterwards and you approve the result in your own words |
| 3 | You see other people's views before giving your own | You are heard alone first. Only then do you see the group |
| 4 | "Consensus" is a score computed from a few votes | Agreement is a set of statements, each traceable to what real people said, with the disagreement published beside it |
| 5 | Consensus is the end | Consensus triggers prioritising at once, and the top priorities go to a host who must answer each one by a date |
| 6 | No record of what happened next | A public register shows every decision as done, changed, delayed or refused, checked by someone other than the host |
| 7 | No way to tell the builders what is wrong with Unite | Feedback is on every page, in conversation, with a page that shows what happened to yours |

The rest of this document covers what went wrong before, the design in detail, what the first build includes, the worked examples for the video, and the choices that are yours to make.

## What went wrong before

There have been four attempts. I ran the two July versions screen by screen and read the September Codex session and its code.

| Attempt | What it was | What it got right | Why it failed |
| --- | --- | --- | --- |
| **July v1**, "the instrument" | A dashboard with three scopes, eight tabs, one-line needs tagged with one of nine "fundamental needs", votes, a scatter map, and a "convergence room" | Ranking by agreement across groups, not by popularity. Showing others' votes only after yours | The first screen is jargon ("T1" appears 148 times, "pod" 112). No AI. No shared system: everything is hand-written demo data in one browser. Publishing an outcome needs two stewards and only one exists, so nothing was ever published |
| **July v2**, chat-first | A chat room of 12 pre-written personas with a "notetaker" | The "here is what I heard: keep, fix or scrap" pattern. A private notebook of everything inferred about you | The notetaker is a keyword template that echoes your sentence back in lower case. Your message box is 3,800 pixels down the page. A reload erases everything. About 10,500 words of copy |
| **September v3** (Codex) | A form-based decision pilot | A clear path from input to action | You rejected it: "I was expecting it to be more like an interactive, like either social media or communicating via AI" |
| **September v4** (Codex) | A live feed in four fixed rooms, a private Claude interviewer, common-ground statements, an action queue | A real AI interview that starts from an ordinary day. Follows "expensive" with "what would it make possible?" | The feed comes first, so people see others before they speak. Actions are intentions with no owner who promised anything. Memory only, English only, never deployed, never checked in a browser |

Five faults run through all four.

1. **Nobody was on the other end.** No version had a host who had committed in advance to respond. The research is blunt about this: processes without a committed implementer produce reports, and vague or broken commitments leave the people who took part disillusioned. Members of the French climate convention rated the government's response 3.3 out of 10.
2. **Machinery came before the conversation.** Identity tiers, signing, pods and consent policies dominated the code and the screens. You asked for Solid to be dropped in September; it should stay dropped.
3. **Abstractions were handed to people.** Needs pickers, economic models, "government" and "income" all appeared as categories to choose from. Your instruction was to draw out the ideal day and its barriers and not to lock in existing constructs.
4. **Consensus was the finish line.** You asked for "you come to consensus, and then there's immediate prioritization". No version had the prioritising step, a decision rule, or anything after it.
5. **No real person ever used it.** Each round added design documents and a new demo surface. None was tested with a group, and none had a way for users to say what was wrong.

**Worth carrying forward:** needs kept apart from solutions as an internal coding scheme, never a picker; cross-group agreement instead of engagement; disagreement published as a result; the "keep, fix or scrap" check; the private notebook; the life-first interview opening from v4; the data protection write-up from v2.

## What Unite is

**Purpose.** Help people anywhere work out together what a good future looks like in ordinary life, agree what to do first, and turn that into technology and social arrangements that actually exist.

Unite runs as one loop.

&#91;embedded content: the Unite loop · 6 steps\]

A person can walk the whole loop in one sitting for a small question, or over weeks for a large one. At every step they can see where the question stands and what is still needed to move on.

### Two layers

**Open listening** is always on. Anyone can have the conversation at any time, about their own life, with no question set by anyone else. What they approve joins a growing public picture of the lives people want and what stands in the way. Open listening promises only this: your words are counted, shown faithfully, and you are told when an assembly opens on something you raised.

**Assemblies** are where things get decided. An assembly is one question, one host and one written pledge. The host is whoever can act on the answer: a council, a company, a standards group, a school, or a community acting for itself. The pledge says what the host has set aside, how the decision will be made, and the date by which every item will get a reasoned answer. An assembly cannot open without one.

Themes that keep coming up in open listening are the natural source of new assemblies. Unite shows which themes have no host yet, so that the gap is visible and someone can step forward.

### Principles

1. **Lives before systems.** Start from a real day. Money, jobs, governments and Unite itself are possible means and never the definition of success.
2. **Heard alone, then together.** Nobody sees the group until they have spoken for themselves.
3. **Your words stay yours.** Nothing enters the shared picture until you have read it and said yes. You can change it or take it back.
4. **The AI asks and never argues.** It has no opinions, offers no facts and suggests no answers. It says it is an AI, and there is always a way to take part without it.
5. **Every sentence has a source.** Any summary can be opened to show the words and the number of people behind it.
6. **Disagreement is a result.** Where people differ is published with the same care as where they agree.
7. **No pledge, no process.** Decisions are only asked for when someone has committed to answer.
8. **Done means checked.** A decision counts as delivered when someone other than the host says so against criteria fixed in advance.
9. **Nothing is ranked by attention.** No likes, follower counts, trending lists or showcases of personal utopias.
10. **Unite is run by its own loop.** Its rules, prompts and models are published, and changes to them go through an assembly.

### Words used in Unite

| Word | Meaning |
| --- | --- |
| Conversation | The private AI interview |
| Point | One thing you said, in your words, that you approved |
| Picture | The shared view of everyone's points: themes, counts, differences and who is missing |
| Statement | A sentence drafted from many points that people can agree with, reject or reword |
| Room | A small live group that works through one disagreement |
| Assembly | One question with a host and a pledge |
| Pledge | The host's written commitment: what is set aside, the rule, the reply date |
| Decision | A statement that passed the rule, with numbered tests for "done" |
| Register | The public list of every decision and what happened to it |

## One person's journey

Amina is an invented example. She works nights in a care home and got a link to an assembly her town is hosting on how people will earn and learn as AI changes local jobs.

| Step | What Amina sees and does | Time |
| --- | --- | --- |
| **Arrive** | One sentence on what Unite is, the assembly's question, who is hosting, and what they have pledged. One button: "Start a conversation". No account is needed to begin | 1 min |
| **Listen** | A private conversation, typed or spoken, in her language. The interviewer asks about her last working day, what mattered in it, what got in the way, and what an ordinary good day would look like a few years from now. She can skip anything and stop at any point | 12 min |
| **Approve** | "Here is what I heard." Five points in her own words. She keeps three, fixes one, scraps one, and chooses how each is shown: counted only, shown without her name, or shown with it | 2 min |
| **See** | The picture opens now, and not before. It shows that 214 people raised something like her point about retraining at night, the main themes, real quotes, where people differ, and which groups have not been heard yet | As long as she likes |
| **React** | Statements drafted from everyone's points. For each she can agree, disagree, say she is unsure, or reword it. She sees how others answered only after she has answered | 5 min |
| **Talk** | She is drawn by lot for a live room: six people who see one trade-off differently, 45 minutes, an AI facilitator keeping time and turns. Everyone gives a private final answer at the end | 45 min, optional |
| **Prioritise** | As soon as statements pass the assembly's rule, she picks the three that matter most to her. The ranked list updates as people choose | 2 min |
| **Hear back** | By the pledged date the host answers every priority: accepted, changed, delayed or refused, each with reasons | A notification |
| **Follow** | Her own page, "What happened to what I said", traces each of her points to a theme, a statement, a decision and its current status | Whenever she likes |
| **Check** | She may be drawn for the check panel that tests what was delivered against the numbered tests in the decision | Optional |

Two things in this table answer faults in the earlier versions. The first session has a payoff: after about fifteen minutes Amina has been heard, has her points, and can see where she stands among everyone else. And she can stop after any step without her contribution being lost or wasted.

## The structured AI interview

The conversation is the centre of Unite. It is structured, meaning the stages and their order are fixed in code, and it is not scripted, meaning the wording of each question comes from what the person just said.

### The stages

| # | Stage | What it asks | Why |
| --- | --- | --- | --- |
| 0 | Welcome | Says it is an AI, what happens to your words, that you can skip or stop, and offers the routes without AI | Informed consent |
| 1 | A real day | "Tell me about yesterday, or your last ordinary day. Start wherever you like." | Real episodes are more reliable than opinions |
| 2 | What mattered | Picks one moment the person mentioned and asks why it mattered, then why that matters | Reaches needs in the person's own terms |
| 3 | What got in the way | What they wanted to do and could not. What stops it | Finds barriers as lived, before any are named as causes |
| 4 | A good ordinary day | "Picture an ordinary Tuesday a few years from now, in a life that is going well. Walk me through it." | An ordinary day avoids fantasy and keeps the rest of life in view |
| 5 | The wider circle | Who else has to be all right for that day to be good. Who might lose from it | Brings other people in without preaching |
| 6 | A trade-off | Two things the person said they want that pull against each other. Which gives way, and when | Stated priorities are only real under a trade-off |
| 7 | How we might get there | Any ideas for what would help: a tool, a rule, a service, a group, a habit | Ideas are stored apart from needs so that one need can have many answers |
| 8 | What you are unsure of | What they do not know, and what would change their mind | Makes room for doubt and for later movement |
| 9 | Here is what I heard | Three to seven points in the person's words. Keep, fix or scrap each | Only approved points go any further |

Inside an assembly the same stages are anchored to the question. The host may add up to three probes, and each is checked for leading wording before the assembly opens.

### Following abstractions down and up

You asked that Unite should not get stuck on abstractions such as income or government. The interviewer has one rule for this. When someone uses a general word like "money", "expensive", "the system" or "the council", it asks one question down and one question up. Down: "When did that last get in your way? What happened?" Up: "If that were sorted, what would it let you do?" The person's own word is kept exactly as said. Unite never replaces it with a category of its own.

### Rules the interviewer cannot break

- One question per turn, and it must respond to what was just said.
- At least one follow-up before leaving a stage.
- No opinions, no facts, no examples of possible answers, and no praise for particular views.
- It reflects using the person's words. It does not improve them.
- It never says what other people think.
- It does not diagnose, advise or promise outcomes. If someone is in distress it stops interviewing and points to help.
- It asks for no names, addresses or other identifying details, and says so if they are offered.

These are enforced in two places. The model is told them, and the server checks every reply before it is shown: one question, no banned patterns, the right stage. A reply that fails is regenerated, and repeated failures fall back to a fixed neutral question for that stage.

### What comes out

Each approved point has a type (a moment, something that matters, a barrier, a wish, an idea, a trade-off or a doubt), the person's wording, links to the turns of the conversation it came from, and the visibility they chose. The full transcript stays private to the person. They can read it, download it and delete it.

### Taking part without the AI

Three routes are always offered: write freely in a single box and have points drawn from it for approval; answer the same stages as plain written questions; or take part through a human host, who records points for the person to approve. All routes produce the same kind of approved point.

### Keeping the interviewer honest

- The prompts and the model version are published, and every change is listed.
- At the end, the person is asked whether the points sound like them and whether the interviewer pushed them anywhere.
- A sample of consented transcripts is reviewed each cycle for leading questions, by people and by a separate automated check.
- Results are broken down by group, so that an interview that works worse for some people shows up.

### The same method in three other places

| Interview | With whom | Produces |
| --- | --- | --- |
| Host intake | An organisation that wants to open an assembly | A draft pledge: what they can act on, what is set aside, what is off the table and why |
| Expert questions | Practitioners and researchers, on questions the rooms asked | Evidence cards with sources, confidence and what other experts dispute |
| Feedback | Anyone using Unite | Structured feedback on Unite itself, covered below |

## From many conversations to shared statements

This is the step where AI summaries usually go wrong: they smooth over minorities, invent agreement and cannot be checked. Unite's synthesis is built so that every output can be opened and verified.

### How the picture is made

1. **Group.** Approved points with similar meaning are grouped into themes. A theme is named with words participants used.
2. **Count.** Counting is done by ordinary code, never by the model. The count is of people, so one person repeating a point does not inflate it.
3. **Write.** The model writes a short description of each theme from the points in it, in batches of at most 100 points, because accuracy falls on larger batches.
4. **Link.** Every sentence carries links to the points behind it and the number of people. A sentence with no source is not shown.
5. **Check.** A named steward reviews the picture before any decision stage. Every summary has a "this is not what was said" button, covered under feedback.

### What the picture shows

- **Themes**, each with its count, quotes people agreed to show, and how it breaks down by group.
- **Good ordinary days.** The founding note asked that people can see each other's ideal futures for inspiration. Unite shows these as moments grouped by what matters in them, without names, profiles or rankings, and only after you have described your own.
- **Where people differ**, with the reasons each side gave.
- **Who is missing.** People may say a little about themselves, such as where they live or what work they do. The picture compares who has spoken with who is affected and shows the gaps. Missing groups are invited. Results are never silently reweighted.
- **Themes without a host**, in open listening, so that the gap is public.

The picture updates as points arrive, so during a live session people can watch it change.

### How statements are made

1. **Draft.** The model drafts candidate statements from the themes. Each lists the points it rests on.
2. **Cover everyone.** The set put to people is chosen so that every sizeable group of opinion has at least one statement written from its side. Picking only the most popular would silence minorities.
3. **React.** Each person can agree, disagree, say they are unsure, or reword. Other people's answers stay hidden until they have answered.
4. **Revise.** Rewordings and objections go back into a second draft. People compare the two. There are at most two rounds.
5. **Sort.** Statements end in one of three places: common ground, where every opinion group supports it at the level the pledge set; where we differ; or not enough voices yet.

Opinion groups are worked out from how people answered and are used only to check that agreement is broad. They are shown as "people who answered like you" and "people who answered differently". They are never given names and never treated as identities.

Common ground is a finding. It becomes a decision only through the assembly's rule, described next.

## Deliberating and deciding

In September you asked for something "more like an interactive, like either social media or communicating via AI", with "open discourse. It's live. You come to consensus, and then there's immediate prioritization." The AI conversation covers the second of those. This section covers the live, open and social part, and it does so without a feed. The evidence is consistent that feeds ranked by attention reward outrage and that seeing others first pulls people's answers together without making them more accurate. So Unite is live and social in three other ways.

### Three kinds of live

**Live sessions.** An assembly schedules sessions at stated times. Everyone who joins is split into small rooms at once, the picture updates in front of them as rooms report, and prioritising happens before the session ends. A session is the closest thing in Unite to a town meeting.

**Rooms.** Five to eight people, drawn by lot from those taking part and mixed so that different views are present. A room takes one trade-off. It gets a briefing of at most two pages with both sides and the evidence cards experts supplied. Everyone speaks once before anyone speaks twice. At the end each person gives a private final answer, and the room's reasons and any new wording go back to the assembly. Rooms can be typed or spoken.

**Reasons.** Under every statement anyone can add a short reason for it, a reason against it, or a question. Reasons are shown side by side so both columns are always seen, in the order they arrived. There are no likes and no replies to people, only to the statement. This is the open discourse, kept on the subject.

### In your own time

Everything above except the room already works whenever it suits you: the conversation, the picture, answering statements, adding reasons, suggesting better wording, and choosing priorities. The room was the one step that needed people in the same place at the same time. That shuts out the people Unite most needs to hear, such as someone who works nights, a carer, or anyone in an assembly that spans time zones. So there are two ways to work through a disagreement without meeting.

**Talk it through.** On any statement you have answered, you can have a short private conversation with the AI about it. It takes about five minutes and has four steps. It asks what is behind your answer, anchored in something that happened to you. It shows you, in their own words, reasons from people who answered differently, and asks what is true in them and what they leave out. It asks whether there is a wording you could agree with that they might too. And it asks what you would want checked before deciding. Then, as in the first conversation, it shows what it heard: a reason, a wording and a question. Only what you approve goes onto the statement, where it joins everyone else's reasons, wordings and questions. A steward can then draft a new version of the statement from all of the suggested wordings, and everyone answers that version afresh.

The AI in this conversation is a go-between, not a debater. It never gives a reason of its own and never says who is right. The other side's reasons are shown as quotations chosen by code: the earliest reason from each of a few different people, never the most popular. This is the same shape as the "Habermas Machine" study, where people wrote their views privately, an AI drafted a group statement, people criticised it and the AI redrafted. Nobody in that study spoke to anybody else, and agreement still rose.

**Slow rooms.** The same room as before, five to eight people drawn by lot and mixed, with the same briefing and the same AI facilitator, but open for several days instead of forty-five minutes. Two things change. You write where you stand before you can read what the others wrote, so the first person to post does not set the frame for everyone else. And the facilitator's timings stretch: it invites people who have not written after a day, marks half time, and asks for wording when a fifth of the time is left. At the end each person still gives a private final answer.

**When each one fits.** These are judgements from the evidence in the literature review, not settled findings, and a host can state in the pledge which will be used.

| | Talk it through | Slow room | Live room |
|---|---|---|---|
| Who | Everyone who has answered the statement | Five to eight people by lot | Five to eight people by lot |
| What it asks of you | About five minutes, at any time | A few minutes a day for three to seven days | Forty-five minutes at a set time |
| Use it when | Many people are involved. The disagreement may be about wording or a missing condition. As a first pass on every statement where people differ | The trade-off needs people to answer each other, and they cannot meet: shift workers, carers, people in several time zones, people writing in a second language | Trust is low or feelings are high. A decision is close and a date is near. People need to hear each other, not only read each other |
| It is weak when | The disagreement is about values. People never answer each other directly, so nobody is surprised by a person | Energy fades. Expect some people to stop coming back, and say how many did | People cannot make the time. It favours fast talkers and fast typists |

The order I recommend is to offer "talk it through" on every statement where people differ, because it costs little, includes everyone and often produces a wording that settles it. Then use a room, slow or live, only for what is still contested. Working in your own time is not always the better choice. Studies of live small-group deliberation report that hearing the other side from a person is what builds respect between people who disagree, and reading a quotation does not do the same. An assembly on something bitter should still bring people together.

### What the AI facilitator does

It keeps time and turns, invites people who have not spoken, asks the room to restate a point it may have misread, and records reasons in the speakers' own words. It does not rewrite what people say, take a side, supply facts or declare agreement. A human can take over any room.

### The rule is set before anyone speaks

Every pledge names one of five levels. Higher stakes need a stronger rule and stronger checks that each voice is one person.

| Level | Used for | Passes when | If it does not pass |
| --- | --- | --- | --- |
| 0. Do | Small, reversible things inside one group's remit | Those affected are asked and it is logged | Not applicable |
| 1. No objection | Routine, reversible changes | Nobody raises a reasoned objection within a set number of days | Goes up a level |
| 2. Consent | Most assembly statements | Common ground across opinion groups, and every reasoned objection answered to the satisfaction of a named facilitator, with dissent recorded | A time-limited trial with a review date |
| 3. Deliberated supermajority | Priorities that affect many people | A panel drawn by lot deliberates. If it cannot reach consent, a ranked vote must beat "no change" two to one | No change |
| 4. Constitutional | Unite's own rules | Three to one, a quorum, a cooling-off period, and ratification by a panel drawn by lot | No change |

An objection counts because of its reasons, however few people hold it. "No agreement" is a valid, published outcome.

On every statement Unite says in plain words what is still needed, for example: "Passes when 40 more people have answered and the objection about night buses has a reply." Concord does the same for change requests and it removes most confusion about process.

### Prioritising straight away

The moment a statement passes, it joins the assembly's priority list and everyone taking part is asked to choose the three that matter most to them. The list is ordered so that it reflects the whole group: once a large group's first choice is placed, its remaining choices count for less, so smaller groups' priorities also reach the top. The order updates live. When the pledged date arrives, the list closes and the top items, up to the capacity the host set aside, go to the host for an answer.

### Kinds of assembly

| Kind | Who decides | The host promises |
| --- | --- | --- |
| Listening only | Nobody; no decision is asked for | To publish the picture and say what they learned |
| Advisory | The assembly recommends | A reasoned answer to every priority by a date |
| Co-decided | The assembly decides within a stated remit and budget | To carry out what passes, or return to the assembly with reasons |
| Community-run | The group is its own host | Named members take on each decision |
| Technology co-design | The assembly decides what to build and tests it | To build it, in the open, against the numbered tests |

## From decision to delivery

This is the half of Unite that no earlier version had. Its purpose is to turn what was agreed into technology and social arrangements, and to make it impossible to quietly drop.

### The decision record

Every statement that passes becomes a record with:

- what was decided, in one sentence;
- why, with links back to the statement, the themes and the points behind it;
- the options that were considered and the dissent that remains;
- **numbered tests for "done"**, written so that an ordinary participant can check them;
- a review date.

### The host's answer

By the pledged date the host answers each priority with one of four words and its reasons: **accepted**, **changed** (with what and why), **delayed** (until when) or **refused**. A missing answer is shown publicly as late, with the number of days. The research behind this is that people accept outcomes that go against them when the process was fair and they were answered. Vague promises and silence are what leave participants disillusioned.

### Working out how to build it

Your founding note asks that Unite "effectively engage experts on how to best build for that future". Once a decision is accepted, practitioners and builders are invited to propose how to meet its tests. Each proposal is a short plan: what would be made or changed, by whom, what it costs, and how each numbered test would be met. The people who made the decision confirm that the chosen plan is faithful to it before work starts.

A decision can be delivered as either of two kinds of thing, and most need both.

| Kind | Examples | How it is delivered |
| --- | --- | --- |
| Technology | An app, a shared data standard, a change to an existing service | A short specification the deciding group confirms, built in small steps each linked to the decision, then tested by the group against the numbered tests |
| Social arrangement | A rule or policy change, a budget line, a new service, a standing group, a pilot | A commitment with an owner and a date, tracked the same way and tested the same way |

For software, AI coding agents can do much of the building, which is what makes a short path from decision to working tool realistic. A named person stays accountable for every piece; an agent never is. This step should be treated as an experiment and measured, because the evidence on agent-built software is still mixed.

### The register

Every decision in every assembly appears in one public register with its current status.

| Status | Meaning |
| --- | --- |
| Awaiting answer | With the host, with the due date shown |
| Accepted, changed, delayed or refused | The host's answer, with reasons |
| In progress | Work has started. This is never counted as done |
| Delivered as decided | The check panel found every numbered test met |
| Delivered with changes | Small or substantial, and the panel says which |
| Not delivered | The date passed or the work was abandoned, with the host's explanation |
| Replaced | A later decision took its place |

Status after "in progress" is set by a **check panel**: a few participants drawn by lot, or an independent body named in the pledge. The host cannot mark its own work as done. The categories are fixed before the assembly starts, because the usual dispute after a citizens' assembly is over what counts as implemented.

The register can be read three ways: by assembly, by host, which gives each host a public record of how often it does what was decided, and by person, which is the "what happened to what I said" page.

### The life of an assembly

| Stage | What moves it on |
| --- | --- |
| Proposed | A host completes the intake interview and drafts a pledge |
| Pledged | The question and the pledge are published and can be challenged for a set period |
| Listening | Enough people, from enough of the affected groups, have had the conversation |
| Picture | A steward confirms the picture is faithful |
| Deliberating | Statements have been through reaction, rooms and revision |
| Deciding | The rule in the pledge is met, or "no agreement" is recorded |
| Answered | The host has answered every priority |
| Delivering | Accepted decisions have plans and owners |
| Checked | The check panel has classified each one |
| Review | Each decision's review date arrives and the question can be reopened |

## Feedback built in

You asked for the feedback features Concord has. I surveyed Concord's code and documentation and Unite takes all of them, fixes the three weaknesses Concord's own notes list, and adds two that only make sense here.

### Taken from Concord

| Feature | In Unite |
| --- | --- |
| "Give feedback" on every page | The same, and it carries the page you were on so nobody has to describe where they were |
| Feedback as a conversation with AI | The same interviewer method, with three ways in: a guided set of questions (about eight minutes), "just tell us something", and "what has changed since you were last here" |
| "What has changed" built from the release list | Each release lists its changes in plain words, says who each one affects, and can carry its own question for testers |
| Answers you can see and edit as you go | A panel beside the chat shows what has been recorded so far. Any answer can be corrected |
| "Submit what I have said so far" | Kept. Half a conversation is still useful |
| Voice | Speak instead of typing, in the browser, with a server fallback |
| It never argues | Concord's rule is kept word for word: "Never argue with feedback or defend the product." |
| No sign-in needed | Kept. A name and contact are optional |
| Opt-in public issue | With permission, a summary becomes a public GitHub issue. The person sees the exact text first, links and email addresses are stripped, and it can be withdrawn |
| Hourly triage | New issues are labelled and get one comment. Nothing else is automated |
| Admin view | Counts, an AI summary of themes with sources, and export as JSON and CSV |
| "Report a problem" on a single item | In Concord this sits on each term. In Unite it sits on every summary, theme and statement |

### Fixed from Concord

| Weakness in Concord | In Unite |
| --- | --- |
| No page showing what happened to your feedback | A "your feedback" page, reachable from a private link, showing each item as received, planned, done or declined, with the reason |
| No limit on the feedback chat beyond a daily spending cap | Limits per person and per address, as well as the spending cap |
| No way to show what you were looking at | Attach a screenshot, or mark the part of the page you mean |

### New in Unite

**"This is not what was said."** Every AI-written summary, theme and statement has this button. It asks what is wrong: something missing, something added, the wrong emphasis, or the wrong count. Reports go to the steward and are shown, with their outcome, next to the summary. This is the main defence against a synthesis that drifts from what people said, and it puts that defence in the hands of the people who said it.

**"Did this sound like you?"** At the end of every conversation the person is asked whether the points are right and whether the interviewer pushed them in any direction. The answers are the main quality measure for the interviewer and are published in aggregate.

### Unite's own feedback runs through Unite

Feedback about the platform is gathered into a standing assembly whose host is the team that maintains Unite. Themes, statements, priorities, answers and the register all work exactly as they do for any other question. The people who run Unite are held to the same rule as every other host: answer every priority by a date, and let someone else check the work.

## Governance, safety and privacy

### Who controls Unite

The founding note says Unite cannot be a single system with a single owner, because whoever owns it would hold too much influence. The earlier versions answered this with heavy technical machinery on day one and never reached a real user. This design answers it in stages, starting with what is cheap and real.

| Stage | What limits any one party's control |
| --- | --- |
| From the first build | Open source. Published rules, prompts and model versions with a change log. Every assembly's pledge, picture, decisions and register can be exported in an open format. Changes to Unite's rules go through a level 4 decision |
| With the first real assemblies | A stewards' council with term limits and a cap on members from one employer. Independent check panels. A published evaluation of each cycle, by group, including where it made things worse |
| When more than one organisation runs it | Several independently run instances that share assemblies and registers through the open format, so that no operator can alter the record alone |

I recommend not building the third stage until at least two organisations want to run Unite. It is the part of the original idea most likely to stop the rest from existing.

### One person, one voice

How sure Unite needs to be that a voice is one real person depends on what the voice is used for.

| Use | Check |
| --- | --- |
| Having the conversation, seeing the picture | None. Points from unchecked people are counted and shown separately |
| Reacting to statements, adding reasons | A confirmed email address or phone number |
| Counting toward a decision at level 2 or 3 | An invitation from the host to a known group of affected people, or an equivalent check named in the pledge |
| Level 4 | As level 3, plus the panel drawn by lot |

There is no voting by tokens, by payment or by unlimited delegation.

### Personal data

People will talk about health, money, family, beliefs and work. Much of that is special category data in law.

- Explicit consent at the start, in plain words, separately for the conversation and for showing any point.
- The transcript is private to the person. Only approved points leave the conversation.
- Points are shown without a name unless the person chooses otherwise. Small groups are not broken down in ways that could identify someone.
- A person can read, download, correct and delete everything Unite holds about them, including what was inferred. Deleting removes their points from the picture and the counts.
- Conversations are not used to train models.
- No assembly with real participants opens before a data protection impact assessment is done. Adults only until safeguarding for children has been designed.

### Risks and what answers them

| Risk | Answer |
| --- | --- |
| The interviewer nudges people | Fixed rules checked by the server, published prompts, the "did it push you" question, sampled review |
| The summary invents or smooths agreement | Code does the counting, every sentence has sources, proportional coverage, the "not what was said" button, steward sign-off |
| Organised groups flood an assembly | Identity checks that rise with the stakes, counts of people not posts, agreement required across opinion groups, unchecked voices shown separately |
| A host uses Unite for show | No pledge, no assembly. Late answers are public. Each host has a public record |
| The loudest or most online decide | The "who is missing" view, targeted invitations, routes without AI and through human hosts, selection by lot for rooms and panels |
| People feel worse after seeing idealised lives | Ordinary days and not showcases, no names or rankings, own conversation first |
| Deep disagreement is papered over | Disagreement is published. "No agreement" is an outcome. Bridging scores are never the decision rule |
| Western, English-speaking defaults | Conversations in the person's language, their own words kept, themes named from participants' words, results by group |

## Architecture and build plan

### What it is built with

Unite uses the same stack as Concord, so the two can share code, habits and hosting.

| Part | Choice | Note |
| --- | --- | --- |
| Interface | React, Vite, Tailwind, TypeScript | Plain, black on white, large type, works on a phone first. No dashboard |
| Server | Express, TypeScript | One ordinary server with a database. This is a real shared system from the first build |
| Data | Postgres in production, the same database engine embedded for development and tests | Everything survives a reload, which no earlier version managed |
| AI | Claude, with every reply checked against a schema and the interviewer rules before it is shown | Daily and monthly spending caps. All prompts in one published file |
| Without an AI key | A fixed-question interviewer that follows the same stages | Keeps tests, demos and the non-AI route working, and is labelled as such |
| Live updates | The page asks the server for changes every couple of seconds | Simple, and it works on any host |
| Hosting | Vercel, as Concord | Needs your go-ahead and a key, listed under decisions |

Solid, pods, signing ceremonies and identity tiers are not in the build.

### What the data looks like

A **person** has **conversations**; a conversation has **turns** and ends in approved **points**. An **assembly** has a **pledge**, **themes**, **statements**, **rooms**, **decisions** and **check results**. A statement collects **reactions** and **reasons**. A decision has **numbered tests**, the host's **answer**, and **delivery items**. **Feedback items** and **releases** sit alongside. Every link from a sentence to its sources is stored, so any summary can be opened.

### What the first build includes

| Area | In the first build | Later |
| --- | --- | --- |
| Conversation | All ten stages, typed or spoken, any language Claude handles, pause and resume, approve points, the non-AI routes | Phone and messaging apps |
| Picture | Themes with counts and quotes, where people differ, who is missing, live updating | Translation of quotes between languages |
| Statements | Draft from points, react, reword, reasons for and against, common ground and differences | Second revision round fully automated |
| Rooms and sessions | Typed live rooms with the AI facilitator, private final answers | Spoken rooms, scheduled mass sessions |
| Deciding | Levels 0 to 3, plain-words "what is still needed", objections with reasons, live prioritising | Level 4 |
| Delivery | Decision records with numbered tests, host answers, build proposals, the register, check panels, "what happened to what I said" | Coding agents wired in to build software decisions |
| Hosts | Intake interview, pledge editor, the five kinds of assembly, invitations, host record | Sign-in with Google or GitHub, organisations with several staff |
| Feedback | Everything in the feedback section | Screenshot marking |
| Trust | Published prompts and rules page, export of any assembly, data download and deletion | Stewards' council tools |

The first build comes with four example assemblies, clearly labelled as examples, each at a different stage so that every screen has something real to show. They are described in the next section.

### How it gets built

This follows the working model you asked for. I write the specification for each part so that no design decision is left open. Opus implementers build each part against it and return a report. I review the code, run it in a browser at phone, tablet and desktop widths, and integrate. Nothing merges without tests passing. The work goes into `jeswr/unite` as a new branch and a draft pull request, in a `redesign/` folder beside the July code, which stays untouched. The Codex draft pull request also stays as it is.

## Worked examples

The build and the narrated video use the same four examples. They are chosen to cover three scales, both kinds of outcome, and every stage of the loop. The people and hosts in the first three are invented and labelled as such on screen. The problems are real, and the video will tie each step to a documented case from the literature review.

| Example | Scale | Host and kind | Stage shown | What the video shows with it |
| --- | --- | --- | --- | --- |
| **Earning and learning as AI changes local jobs.** "What would let people here keep earning and keep learning as work changes?" | A town | A council and a college, co-decided, with a training budget and timetable set aside | Listening through deciding | Amina's conversation, her points, the picture, a live room on one trade-off, the rule being met, live prioritising |
| **Volunteering without repeating yourself.** "What should a shared volunteering tool do for volunteers and the groups they help?" | A sector, and a piece of technology | A network of volunteer centres, technology co-design | Answered through checked | A decision record with numbered tests, the host's answers including one refusal with reasons, a build proposal, a working increment, the check panel, the register |
| **AI and care.** "In looking after people, what should AI do and what should stay with humans?" | Global | No host yet. A theme from open listening, then a coalition steps forward | Open listening through pledged | Conversations in several languages, who is missing by region, a theme without a host, the intake interview, a pledge being published and challenged |
| **Making Unite better.** | The platform itself | The Unite maintainers, advisory. This one is real | Running | The feedback conversation, "this is not what was said", "your feedback", the maintainers' own record in the register |

The first example comes from the October bid, which names jobs and skills under AI as its first problem area. The second connects to Concord, whose own walkthrough uses a volunteering data standard: Unite decides what should be built and Concord governs the standard underneath it.

### Real cases the video will cite

| Step | Real case |
| --- | --- |
| AI interviews at scale that people accept as accurate | Chopra and Haaland's 766 AI-led interviews, where 99% of people approved the AI's summary of their views; Anthropic's interviews with 1,250 professionals |
| Hearing people alone before showing the group | Lorenz and colleagues' experiments on social influence |
| AI-drafted statements that groups prefer to a human mediator's, and the warning that agreement still drifts toward the majority | The "Habermas Machine" study by Tessler and colleagues |
| Small facilitated rooms online, at scale | Stanford's online deliberation platform |
| Why the rule and the count must be fixed in advance | The French climate convention: the government counts 100 of 149 measures as implemented in full or in part, and an independent count finds about a fifth implemented as proposed |
| Why the host must commit before anyone is asked | Font and colleagues' study of 571 proposals from Spanish local processes: about a third were carried out in full, and backing from both politicians and officials raised the chance from 17% to 46% |

### Shape of the video

About eight to ten minutes, made the way Concord's is: screen recordings of the real application driven by a script, with each line of narration tied to an action that must actually appear on screen. Chapters: why Unite, one person's conversation, the picture, a room and a decision, prioritising, the host's answer and the register, a decision becoming a tool, open listening across the world, feedback, and what comes next.

## Decisions for Jesse

These are the choices that change what Unite is. I am building on the recommended option for each, and each can be reversed if you choose differently.

| # | Decision | Recommendation | Why | If you choose otherwise |
| --- | --- | --- | --- | --- |
| 1 | **Live and social without a feed.** You asked for something like social media. The design gives live sessions, rooms and reasons under statements, and no scrolling feed of posts | No feed | Attention-ranked feeds reward outrage, and seeing others first distorts what people say. The live parts keep what you wanted from social media: other people, in real time, in the open | I add a time-ordered public stream of approved points per assembly, shown only after your own conversation, with no likes or ranking |
| 2 | **No pledge, no assembly.** Decisions are only asked for when a host has committed to answer. Open listening covers everything else | Keep the rule | It is the difference between Unite and the four earlier attempts | Assemblies can open without a host, and are labelled as having nobody to act on them |
| 3 | **Decentralisation in stages.** Open source, published rules and exportable records now; several independent operators later; Solid stays out | Stage it | The earlier versions built this first and never reached a user | I design the multi-operator format now, which adds weeks before anything can be used |
| 4 | **The first real assembly.** The examples are invented. Unite needs one real host and one real group | Start with Unite's own feedback assembly, then one host from the bid's communities on jobs and skills | It tests the whole loop with people who have a reason to care | Tell me who the first host should be and I will shape the example and the pledge around them |
| 5 | **Where it runs.** A public preview on Vercel under your account, with a Claude API key and a hosted database | Go ahead when you say so | A preview you can click is worth more than screenshots | It stays as a branch you run locally, and the video is recorded from a local copy |
| 6 | **Invented or real hosts in the video.** | Invented hosts, real problems, real cases cited | Naming a real council or charity as if it had made a pledge would misrepresent them | Give me organisations that have agreed to be named |

### What I still need from you

- **Decision 5** needs your explicit go-ahead before I deploy anything public, and a Claude API key added in Vercel by you. I do not handle keys.
- **Network access** for this workspace to Vercel and ElevenLabs, as asked in the thread.
- **The IDEA programme video**, if it exists somewhere I could not reach. Otherwise the Concord recipe is the model.

### What comes next

1. The build specification, written from this document.
2. The first build, in `jeswr/unite` as a draft pull request.
3. The narrated video, recorded from the running application.
