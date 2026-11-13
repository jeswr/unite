/**
 * What happens on screen. Each action is named in narration.md as [do: name] or
 * [then: name], and drives the real Unite app being recorded.
 *
 * Every action checks that what its paragraph says is really on screen (d.claim and
 * d.claimVisible), and finds elements by role and text, never by position, so a renamed
 * button is a warning (and fails --strict) rather than a ring around the wrong thing.
 *
 * Actions whose pages aren't built yet are "pending" (PENDING_ACTIONS): in a draft they show
 * a plain card with their name, so the timing of the whole script can still be judged; with
 * --strict or --publish they fail.
 */
import type { Locator } from '@playwright/test';
import { sleep, type Director } from './lib/director.ts';
import { LIVE_ROOM_LINES } from './lib/live-room.ts';
import type { Narration } from './lib/narration.ts';
import { signCookie } from './lib/servers.ts';

export interface Ctx {
  d: Director;
  /** The recorded app's origin, e.g. http://localhost:43121 */
  url: string;
  /** Optional features the recorded app has (`ai`: the AI interviewer is on). */
  features: Set<string>;
  /** Pending actions fail instead of showing a placeholder card. */
  strict: boolean;
  /** The scene being recorded. */
  scene?: { id: string; title: string };
  /** The recorded app's session secret and live-room fixture token (see lib/unite-server.ts). */
  app?: { secret: string; fixtureToken: string };
  /** What one action leaves for a later one (the live room's id and members). */
  memo: { room?: { id: string; members: Record<string, string> } };
}

export type Action = (ctx: Ctx) => Promise<void>;

/** The worked example the first chapters follow. */
const EARNING = '/a/earning-and-learning';

const main = (c: Ctx) => c.d.page.getByRole('main');
const h1 = (c: Ctx, name: RegExp | string) => main(c).getByRole('heading', { level: 1, name });
/** A <section> of the page, found by its heading. */
const section = (c: Ctx, heading: RegExp | string) => main(c).locator('section').filter({ has: c.d.page.getByRole('heading', { name: heading }) });

async function openPage(c: Ctx, path: string, heading: RegExp | string, what: string) {
  await c.d.goto(`${c.url}${path}`);
  await c.d.claimVisible(h1(c, heading), what);
}

async function ringWithText(c: Ctx, target: Locator, text: RegExp, what: string, tag?: string) {
  await c.d.claimVisible(target.filter({ hasText: text }), `${what} says ${text}`);
  await c.d.highlight(target.filter({ hasText: text }), what, tag);
}

/* ------------------------------------------------------------------ the viewer, Amina */

/** Amina's invitation to Riverbend (INVITE_CODES.earning in the seed). */
const INVITE = 'RIVERBEND-2026';

/**
 * What Amina types to the fixed-question interviewer, stage by stage. Each stage asks an opener
 * and a follow-up; the points at the end are the first sentence of her longest answer in stages
 * 1, 2, 3, 4 and 7. Her answer about classes ("on when I'm at work or asleep") is the one that
 * shares enough words with the seed's theme "On when I'm at work or asleep" for the picture's
 * regrouping (word overlap, without the AI) to put it there.
 */
const AMINA = {
  realDay: ['I got in from the care home at eight, slept till two, then did the school run.', 'Tea with the kids, then the bus back for nine.'],
  mattered: ['Sitting with a frightened resident at four in the morning. Nobody measures that.', 'Because I’m good at it. That’s real care.'],
  inTheWay: ['I wanted to start the nursing course, but it’s too expensive.', 'The nursing course is on when I’m at work or asleep. I do nights, so days are for sleep.'],
  goodDay: ['Home by eight, sleep till two, then an hour of my nursing course. Then the school run.', 'Tea together, and nobody rushing off to a shift.'],
  help: 'Classes online at night. Recorded, so I can stop when a buzzer goes.',
  /** Added to her good-day point on the review page. */
  fix: ' online',
  own: 'Twelve years of care work, and none of it counts on paper.',
};

const until = async (test: () => Promise<boolean>, ms: number, every = 200) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(every)) if (await test().catch(() => false)) return true;
  return test().catch(() => false);
};

const turns = (c: Ctx) => main(c).getByRole('list', { name: 'The conversation so far' }).getByRole('listitem');
const interviewerSaid = (c: Ctx, text: RegExp) => turns(c).filter({ hasText: /^Interviewer/ }).filter({ hasText: text });

/**
 * Scrolls to the newest turn. The page scrolls its end marker to the bottom of the window, where
 * the fixed message box covers the last turn, so scroll to the end of the page instead.
 */
async function toLatest(c: Ctx) {
  await c.d.page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
  await c.d.pause(450);
}

/** Types an answer to the interviewer, sends it, and waits for the next question. */
async function answer(c: Ctx, text: string) {
  const before = await turns(c).count();
  await c.d.type(main(c).getByRole('textbox', { name: 'Your answer' }), text, 'the answer box', 26);
  await c.d.pause(250);
  await c.d.click(main(c).getByRole('button', { name: 'Send', exact: true }), 'the Send button', { settle: false });
  const thinking = turns(c).filter({ hasText: 'The interviewer is thinking' });
  c.d.claim(await until(async () => (await thinking.count()) === 0 && (await turns(c).count()) >= before + 2, 10_000), `the interviewer took "${text.slice(0, 30)}…" and asked the next question`);
  await toLatest(c);
}

/** Rings the interviewer's question, lets it be read, then lets go before the page scrolls. */
async function showQuestion(c: Ctx, text: RegExp, what: string, ms = 900) {
  await toLatest(c);
  await c.d.claimVisible(interviewerSaid(c, text), `the interviewer asks ${what}`);
  await c.d.highlight(interviewerSaid(c, text).last(), `the question ${what}`);
  await c.d.pause(ms);
  await c.d.clearHighlight();
}

async function skipStage(c: Ctx) {
  const before = await turns(c).count();
  await c.d.click(main(c).getByRole('button', { name: 'Skip this' }), 'the Skip this button', { settle: false });
  c.d.claim(await until(async () => (await turns(c).count()) > before, 8000), 'skipping a stage moves on to the next question');
  await toLatest(c);
}

const points = (c: Ctx) => main(c).getByRole('list', { name: 'Your points' }).getByRole('listitem');
const point = (c: Ctx, n: number) => points(c).filter({ has: c.d.page.getByRole('textbox', { name: `Point ${n}, in your words` }) });

/** A theme card in the picture, found by its name. */
const theme = (c: Ctx, name: RegExp) => main(c).getByRole('listitem').filter({ has: c.d.page.getByRole('heading', { level: 3, name }) }).first();
const CLASSES = /^On when I.m at work or asleep$/;

/** A statement in Riverbend, opened from the list by its words. */
async function openStatement(c: Ctx, words: RegExp, what: string) {
  await c.d.clearHighlight();
  if (!c.d.page.url().endsWith(`${EARNING}/statements`)) await openPage(c, `${EARNING}/statements`, 'Statements', 'the statements');
  await c.d.click(main(c).getByRole('link', { name: words }).first(), what);
  await c.d.claimVisible(h1(c, words), what);
}

/** Answers the statement on screen, unless Amina already has. */
async function react(c: Ctx, value: 'Agree' | 'Disagree' | 'Not sure') {
  const button = section(c, 'Your answer').getByRole('button', { name: value, exact: true });
  if ((await button.getAttribute('aria-pressed').catch(() => null)) === 'true') return;
  await c.d.click(button, `the ${value} button`);
  await c.d.claimVisible(section(c, 'How people answered'), 'how others answered, shown once she has answered');
}

/** The person recording, as the app knows them. */
async function viewerId(c: Ctx): Promise<string> {
  const me = (await c.d.page.evaluate(() => fetch('/api/me').then((r) => r.json()))) as { person?: { id: string } | null };
  if (!me.person) throw new Error('The viewer has no person record yet');
  return me.person.id;
}

/** Opens the live room for the viewer through the recording's fixture (lib/unite-server.ts). */
async function openLiveRoom(c: Ctx) {
  if (c.memo.room) return c.memo.room;
  if (!c.app) throw new Error('The live room needs the recorded app’s fixture token');
  const res = await fetch(`${c.url}/__walkthrough/live-room`, { method: 'POST', headers: { 'x-walkthrough-token': c.app.fixtureToken }, body: JSON.stringify({ personId: await viewerId(c) }) });
  if (!res.ok) throw new Error(`Opening the live room failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { roomId: string; members: { key: string; id: string }[] };
  c.memo.room = { id: body.roomId, members: Object.fromEntries(body.members.map((m) => [m.key, m.id])) };
  return c.memo.room;
}

/** Posts a line in the live room as one of its seeded members, through the app's own endpoint. */
async function sayInRoom(c: Ctx, who: string, text: string) {
  const room = c.memo.room;
  if (!room || !c.app) throw new Error('The live room is not open');
  const sid = encodeURIComponent(signCookie(room.members[who]!, c.app.secret));
  const res = await fetch(`${c.url}/api/rooms/${room.id}/messages`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: `unite_sid=${sid}` }, body: JSON.stringify({ text }) });
  c.d.claim(res.ok, `${who} could post in the room (HTTP ${res.status})`);
}

const roomMessages = (c: Ctx) => section(c, 'The conversation').getByRole('listitem');
const roomMessage = (c: Ctx, author: RegExp | string, text: RegExp) => roomMessages(c).filter({ hasText: author }).filter({ hasText: text });
const firstName = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);

/** The actions that work against the pages Unite has today. */
export const implemented = {
  async 'title-card'(c) {
    await c.d.chapter({ eyebrow: 'A walkthrough', title: 'Unite', sub: 'Working out, together, what a good ordinary life looks like. And making sure something happens.' }, 0);
    await c.d.pause(900);
    // Load the home page under the card, so the next shot is ready.
    await c.d.goto(`${c.url}/`, { keepCard: true });
  },

  async 'open-home'(c) {
    await openPage(c, '/', /good ordinary life/i, 'the home page');
    await c.d.pointAt(main(c).getByRole('link', { name: 'Start a conversation' }), 'the Start a conversation button');
  },

  async 'point-loop'(c) {
    const loop = main(c).getByRole('list', { name: /The loop/ });
    await c.d.claim((await loop.getByRole('listitem').count()) === 6, 'the loop has six steps');
    await c.d.pointAt(loop, 'the loop');
    await ringWithText(c, loop, /Deliver/, 'the loop, with the steps after the talking', 'Listen, see, talk, then decide, deliver, check');
    await c.d.pause(4200);
    // "Nothing is asked of you here unless somebody has already promised to answer."
    const promise = main(c).getByRole('paragraph').filter({ hasText: /promised to answer/ });
    await ringWithText(c, promise, /host has promised to answer/, 'the promise to answer');
  },

  async 'open-earning'(c) {
    await openPage(c, EARNING, /keep earning and keep learning/i, 'the Riverbend question');
    // "The town, the council and the people in it are invented."
    const note = c.d.page.getByRole('note').filter({ hasText: /invented/ });
    await ringWithText(c, note, /Example/, 'the example notice', 'An invented example');
    await c.d.pause(3800);
    await c.d.highlight(h1(c, /keep earning and keep learning/i), 'the question');
  },

  async 'highlight-pledge'(c) {
    // The link is further down the page: let go of the question's ring before scrolling to it.
    await c.d.clearHighlight();
    await c.d.click(main(c).getByRole('link', { name: 'Read the full pledge' }), 'the Read the full pledge link');
    await c.d.claimVisible(h1(c, 'The pledge'), 'the pledge page');
    // "A quarter of a million pounds and the college's evening timetable."
    await ringWithText(c, section(c, 'What is set aside'), /£250,000.*evening/, 'what is set aside', 'Set aside');
    await c.d.pause(3600);
    // "They've said what's off the table, and why."
    await ringWithText(c, section(c, /off the table/), /because/, 'what is off the table', 'Off the table, and why');
    await c.d.pause(2600);
    // "They've promised to answer the top five priorities by the eighteenth of December."
    await ringWithText(c, section(c, 'When the host will answer'), /top 5 priorities by 18 December 2026/, 'when the host will answer', 'The answer, by a date');
  },

  async 'highlight-stage-tracker'(c) {
    await openPage(c, EARNING, /keep earning and keep learning/i, 'the Riverbend question');
    const stages = main(c).getByRole('list', { name: 'Stages of this assembly' });
    // The pledge came before anything was asked: "behind it from the start".
    await c.d.claimVisible(stages.getByRole('listitem').filter({ hasText: /Pledged \(done\)/ }), 'the pledge stage came first and is done');
    await c.d.highlight(main(c).getByRole('heading', { name: 'Where this assembly is' }), 'where this assembly is');
    await c.d.pause(2200);
    await c.d.clearHighlight();
    await c.d.scroll(420);
    await c.d.highlight(stages.getByRole('listitem').filter({ hasText: /Pledged/ }).first(), 'the pledge stage', 'The pledge comes first');
  },

  async 'start-conversation'(c) {
    await c.d.clearHighlight();
    // Amina is a new person: her invitation link joins her to Riverbend.
    await openPage(c, `${EARNING}?invite=${INVITE}`, /keep earning and keep learning/i, 'the Riverbend question');
    await c.d.claimVisible(main(c).getByRole('note').filter({ hasText: /invitation has been accepted/ }), 'her invitation is accepted');
    // The app has no page for a display name yet; she gives hers through its own endpoint.
    const named = await c.d.page.evaluate(() =>
      fetch('/api/me', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName: 'Amina' }) }).then((r) => r.ok),
    );
    c.d.claim(named, 'Amina has a display name');
    await c.d.label('Amina, a night care worker (invented)');
    await ringWithText(c, main(c).getByRole('note'), /invitation has been accepted/, 'the invitation', 'Invited to take part');
    await c.d.pause(2600);
    await c.d.clearHighlight();
    await c.d.click(main(c).getByRole('link', { name: 'Start my conversation' }), 'the Start my conversation button');
    await c.d.claimVisible(h1(c, 'Start a conversation'), 'the start of a conversation');
    await c.d.label('Amina, a night care worker (invented)');
    // "On her own, before she's seen what anyone else thinks." (The route also says "About 12 minutes", which a later line repeats.)
    const route = main(c).getByRole('radio', { name: /Talk with the AI interviewer/ });
    await c.d.claimVisible(main(c).getByText(/About 12 minutes/), 'the conversation takes about twelve minutes');
    await c.d.highlight(route.locator('xpath=ancestor::label'), 'the AI interviewer route', 'A private conversation');
  },

  async 'show-consent'(c) {
    const lines = main(c).getByRole('list').filter({ hasText: /AI interviewer/ });
    await c.d.claimVisible(lines.getByRole('listitem').filter({ hasText: /AI interviewer\. It asks questions and listens\. It has no opinions and will not give advice/ }), 'it says it is an AI with no opinions and no advice');
    await c.d.claimVisible(lines.getByRole('listitem').filter({ hasText: /What you type stays private to you/ }), 'what she types stays private');
    await c.d.highlight(lines.getByRole('listitem').filter({ hasText: /AI interviewer/ }), 'the line saying it is an AI', 'It says it is an AI');
    await c.d.pause(4200);
    await c.d.highlight(lines.getByRole('listitem').filter({ hasText: /stays private/ }), 'the privacy line', 'What she types stays private');
    await c.d.pause(3200);
    await c.d.clearHighlight();
    await c.d.click(main(c).getByRole('button', { name: 'I understand. Start' }), 'the Start button');
    await c.d.claimVisible(h1(c, 'Your conversation'), 'the conversation');
  },

  async 'answer-real-day'(c) {
    await c.d.label();
    await showQuestion(c, /Tell me about yesterday/, 'about yesterday', 1500);
    if (!c.features.has('ai')) {
      await ringWithText(c, main(c).getByRole('note'), /fixed questions/, 'the fixed-questions notice', 'Fixed questions in this recording');
      await c.d.pause(1300);
      await c.d.clearHighlight();
    }
    await answer(c, AMINA.realDay[0]);
    await showQuestion(c, /What happened after that/, 'what happened next', 600);
    await answer(c, AMINA.realDay[1]);
  },

  async 'answer-mattered'(c) {
    await showQuestion(c, /one moment from that day that mattered to you.*why did it matter/, 'about a moment that mattered, and why');
    await answer(c, AMINA.mattered[0]);
    await showQuestion(c, /why is that important to you/, 'why it matters', 600);
    await answer(c, AMINA.mattered[1]);
  },

  async 'answer-expensive'(c) {
    await showQuestion(c, /something you wanted to do that day.*could not/, 'what she wanted to do and could not', 1000);
    await answer(c, AMINA.inTheWay[0]);
    await showQuestion(c, /What stops it\?/, 'what stops her', 1200);
    await answer(c, AMINA.inTheWay[1]);
    await c.d.highlight(turns(c).filter({ hasText: /^You/ }).filter({ hasText: 'at work or asleep' }), 'her answer about the classes', 'Her own words');
    await c.d.pause(1500);
    await c.d.clearHighlight();
  },

  async 'answer-good-day'(c) {
    await showQuestion(c, /ordinary weekday a few years from now, in a life that is going well/, 'about an ordinary weekday a few years from now');
    await answer(c, AMINA.goodDay[0]);
    await showQuestion(c, /afternoon and evening of that day/, 'about the rest of that day', 600);
    await answer(c, AMINA.goodDay[1]);
  },

  async 'show-stage-names'(c) {
    const steps = main(c).getByRole('navigation', { name: 'Steps of the conversation' });
    c.d.claim((await steps.getByRole('listitem').count()) === 8, 'the conversation has eight stages');
    await c.d.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await c.d.pause(600);
    await c.d.highlight(steps, 'the eight stages', 'Eight short stages');
    await c.d.pause(2400);
    await c.d.clearHighlight();
    // "About twelve minutes in all", as the start page said.
    // "She can skip any of them, or stop."
    await skipStage(c);
    await skipStage(c);
    await showQuestion(c, /What do you think would help/, 'what would help', 700);
    await answer(c, AMINA.help);
    await c.d.pointAt(main(c).getByRole('button', { name: 'Stop here and review' }), 'the Stop here and review button');
  },

  async 'open-review'(c) {
    await c.d.click(main(c).getByRole('button', { name: 'Stop here and review' }), 'the Stop here and review button', { settle: false });
    await c.d.click(c.d.page.getByRole('dialog').getByRole('button', { name: 'Stop and see my points' }), 'the Stop and see my points button');
    await c.d.claimVisible(h1(c, 'Here is what I heard'), 'the review of her points');
    await c.d.claimVisible(point(c, 5), 'five points');
    c.d.claim((await points(c).count()) === 5, 'the interviewer shows five points');
    await c.d.highlight(main(c).getByRole('paragraph').filter({ hasText: /points I took from what you said, in your words/ }), 'the review explained', 'In her own words');
    await c.d.pause(2200);
    // Built from her own phrases: open where one came from.
    await c.d.clearHighlight();
    const third = point(c, 3);
    await c.d.click(third.getByText('From what you said'), 'From what you said, under point 3', { settle: false });
    await c.d.highlight(third, 'point 3 and the words it came from', 'From her own words');
  },

  async 'edit-point'(c) {
    await c.d.clearHighlight();
    // She scraps one...
    await c.d.click(point(c, 1).getByRole('button', { name: 'Scrap this point' }), 'Scrap this point, on point 1');
    await c.d.claimVisible(points(c).filter({ hasText: 'Scrapped. This point will not be shared.' }), 'point 1 is scrapped');
    // ...fixes one...
    const fourth = main(c).getByRole('textbox', { name: 'Point 4, in your words' });
    if (await c.d.click(fourth, 'point 4', { settle: false })) {
      await fourth.press('ControlOrMeta+End');
      await fourth.press('Backspace');
      await fourth.pressSequentially(`${AMINA.fix}.`, { delay: c.d.fast ? 0 : 90 });
    }
    // ...chooses how it is shown (leaving the box saves the new words)...
    const shown = point(c, 4).getByRole('group', { name: 'How it is shown' });
    await c.d.click(shown.getByRole('radio', { name: /Counted only/ }), 'Counted only, for point 4');
    await c.d.highlight(shown, 'how point 4 is shown', 'Counted, unnamed, or named');
    await c.d.pause(2000);
    await c.d.clearHighlight();
    // ...and adds one of her own.
    await c.d.click(main(c).getByRole('button', { name: 'Add a point of your own' }), 'Add a point of your own');
    await c.d.page.getByRole('combobox', { name: 'What kind of point is it?' }).selectOption({ label: 'What gets in the way' });
    await c.d.type(main(c).getByRole('textbox', { name: 'Your point' }), AMINA.own, 'her own point', 22);
    await c.d.click(main(c).getByRole('button', { name: 'Add this point' }), 'Add this point');
    await c.d.claimVisible(main(c).getByRole('textbox', { name: 'Point 6, in your words' }), 'her own point is added');
  },

  async 'approve-points'(c) {
    await c.d.click(main(c).getByRole('button', { name: 'These are right' }), 'These are right');
    await c.d.claimVisible(h1(c, 'Your points are shared'), 'her points are shared once she approves them');
    const kept = section(c, 'Your points').getByRole('listitem');
    c.d.claim((await kept.count()) === 5, 'five points are shared');
    c.d.claim((await kept.filter({ hasText: 'at work or asleep' }).count()) === 1, 'her point about classes is shared');
    await c.d.claim((await kept.filter({ hasText: `course${AMINA.fix}.` }).count()) === 1, 'her fixed point is shared as she fixed it');
    await c.d.highlight(section(c, 'Your points'), 'the points she approved', 'Only what she approves leaves');
    await c.d.pause(5200);
    await c.d.clearHighlight();
    // The two optional exit questions.
    await c.d.click(main(c).getByRole('radio', { name: 'Just like me' }), 'Just like me');
    await c.d.click(main(c).getByRole('radio', { name: 'No', exact: true }), 'No');
    await c.d.click(main(c).getByRole('button', { name: 'Send my answers' }), 'Send my answers');
    await c.d.claimVisible(h1(c, 'Thank you'), 'the thank-you page');
  },

  async 'open-picture'(c) {
    await c.d.click(main(c).getByRole('link', { name: 'See the picture' }), 'See the picture');
    await c.d.claimVisible(h1(c, 'The picture'), 'the picture');
    // Her points join the picture when it regroups (the page asks for it once five points wait).
    const classes = theme(c, CLASSES);
    let placed = await until(async () => (await classes.getByText('You said this').count()) > 0, 15_000, 300);
    if (!placed) {
      await c.d.goto(`${c.url}${EARNING}/picture`);
      placed = await until(async () => (await classes.getByText('You said this').count()) > 0, 15_000, 300);
    }
    c.d.claim(placed, 'her point joined the picture');
    await ringWithText(c, main(c).getByRole('paragraph'), /^49 people have spoken so far/, 'how many people have spoken', 'Forty-nine people');
    await c.d.pause(2600);
    await c.d.highlight(main(c).getByRole('heading', { level: 2, name: 'What matters' }), 'the first group of themes', 'Grouped by what it’s about');
  },

  async 'point-her-theme'(c) {
    const card = theme(c, CLASSES);
    await c.d.clearHighlight();
    // "With eighteen other people": nineteen in all.
    await c.d.claimVisible(card.getByText(/^19 people$/), 'the theme has nineteen people, Amina and eighteen others');
    await c.d.highlight(card.getByRole('heading', { level: 3, name: CLASSES }), 'her theme');
    await c.d.pause(1200);
    await c.d.highlight(card.getByText(/^19 people$/), 'the number of people in her theme', 'Amina and eighteen others');
    await c.d.pause(1800);
    await c.d.highlight(card.getByRole('listitem').filter({ hasText: 'You said this' }), 'her point in the theme', 'Amina’s point');
    await c.d.pause(2200);
    // The name is a phrase one of them used.
    const said = card.getByRole('list', { name: /What people said about/ }).getByRole('listitem').filter({ hasText: /on when I.m at work or asleep/i });
    await c.d.highlight(said, 'the quote the theme is named from', 'The name is their phrase');
  },

  async 'open-sources'(c) {
    const card = theme(c, CLASSES);
    const sentence = card.getByRole('listitem').filter({ has: c.d.page.getByText(/^Sources:/) }).first();
    await c.d.clearHighlight();
    await c.d.click(sentence.getByText(/^Sources: \d+ people$/), 'the Sources of the first sentence', { settle: false });
    await c.d.claimVisible(sentence.locator('details[open] li').first(), 'the words behind the sentence');
    await c.d.highlight(sentence, 'the sentence and its sources', 'The words, and how many people');
    await c.d.pause(4200);
    await c.d.clearHighlight();
    await c.d.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await c.d.pause(700);
    await ringWithText(c, main(c).getByRole('paragraph'), /Every count is of people, worked out from the points they approved/, 'how counts are made', 'Counted by code');
  },

  async 'point-not-what-was-said'(c) {
    await c.d.clearHighlight();
    await c.d.pointAt(theme(c, CLASSES).getByRole('button', { name: 'This is not what was said' }), 'the This is not what was said button');
    await c.d.highlight(theme(c, CLASSES).getByRole('button', { name: 'This is not what was said' }), 'the report button', 'Anyone can say so');
    await c.d.pause(2400);
    const counts = theme(c, /^What I already know doesn.t count$/);
    const report = counts.getByRole('listitem').filter({ hasText: /^Something is missing/ });
    await c.d.claimVisible(report.getByText(/^Upheld:/), 'a report shown beside the summary, with what was done');
    await c.d.highlight(report, 'the upheld report and its outcome', 'Reported, and what was done');
  },

  async 'point-who-is-missing'(c) {
    const missing = section(c, 'Who we have not heard from');
    await c.d.clearHighlight();
    await c.d.claimVisible(missing.getByRole('listitem').filter({ hasText: /Under 25.*3 of 10 hoped for/ }), 'three under-25s heard, ten hoped for');
    await c.d.highlight(missing, 'who has not been heard', 'Who is missing');
    await c.d.pause(2200);
    await c.d.highlight(missing.getByRole('listitem').filter({ hasText: /Under 25/ }), 'the under-25s', 'Three of ten hoped for');
  },

  async 'open-statements'(c) {
    await c.d.clearHighlight();
    await c.d.click(main(c).getByRole('link', { name: 'Go to the statements drafted from this picture' }), 'the link to the statements');
    await c.d.claimVisible(h1(c, 'Statements'), 'the statements');
    await ringWithText(c, main(c).getByRole('paragraph'), /drafted from what people said/, 'how statements are made', 'Drafted from the picture');
    await c.d.pause(1800);
    await openStatement(c, /^People who work nights or rotating shifts/, 'the statement about shift workers');
    const rests = section(c, 'What this rests on');
    await c.d.claimVisible(rests.getByText(/From the picture: On when I.m at work or asleep/), 'the statement lists the theme it rests on');
    await c.d.highlight(rests, 'what the statement rests on', 'The points it rests on');
  },

  async 'react-statement'(c) {
    await c.d.clearHighlight();
    // Before she answers, nothing of how others answered is shown.
    await c.d.claimVisible(section(c, 'What is still needed').getByText(/Answer to see how others answered/), 'others’ answers are hidden until she answers');
    await c.d.highlight(section(c, 'Your answer'), 'her answer, first', 'She answers first');
    await c.d.pause(1600);
    await c.d.clearHighlight();
    await react(c, 'Agree');
    await c.d.highlight(section(c, 'How people answered'), 'how others answered', 'Then she sees the others');
  },

  async 'open-differ'(c) {
    await c.d.clearHighlight();
    await openPage(c, `${EARNING}/statements`, 'Statements', 'the statements');
    // Until she answers a statement, where it stands stays hidden: it waits under "Still to answer".
    const toAnswer = section(c, 'Still to answer');
    const retrain = /^Nobody should have to lose pay to retrain/;
    await c.d.claimVisible(toAnswer.getByText(/Where each of these stands shows once you have answered it/), 'where a statement stands shows once she answers');
    await c.d.highlight(toAnswer.getByRole('listitem').filter({ hasText: retrain }), 'a statement she has not answered yet', 'Not answered yet');
    await c.d.pause(2000);
    await openStatement(c, retrain, 'the statement on losing pay to retrain');
    await react(c, 'Agree');
    await c.d.claimVisible(main(c).getByText('Where we differ', { exact: true }).first(), 'the statement is published as one where people differ');
    await c.d.highlight(main(c).getByText('Where we differ', { exact: true }).first(), 'where people differ', 'Where we differ, published too');
    await c.d.pause(1600);
    const alike = section(c, 'How people answered').getByRole('list');
    const other = alike.getByRole('listitem').filter({ hasText: /answered differently from the majority/ });
    await c.d.claimVisible(other, 'how the other side answered');
    const share = Number(/agree \((\d+)%\)/.exec((await other.textContent()) ?? '')?.[1] ?? 100);
    c.d.claim(share < 60, `the statement split the room (${share}% of the other side agree)`);
    await c.d.highlight(alike, 'how the two sides answered', 'It split the room');
  },

  async 'point-reasons'(c) {
    await c.d.clearHighlight();
    await openStatement(c, /^Everyone should be taught to use AI tools/, 'the statement on AI tools');
    const reasons = section(c, 'Reasons');
    await c.d.claimVisible(reasons.getByText('In the order they arrived. Nothing here is ranked.'), 'reasons in the order they arrived');
    c.d.claim((await reasons.getByRole('list').count()) === 2, 'reasons for and against, side by side');
    c.d.claim((await main(c).getByRole('button', { name: /like|reply/i }).count()) === 0, 'no likes and no replies');
    await c.d.highlight(reasons.getByRole('heading', { level: 3, name: 'For' }), 'the reasons for', 'For');
    await c.d.pause(1600);
    await c.d.highlight(reasons.getByRole('heading', { level: 3, name: 'Against' }), 'the reasons against', 'Against');
    await c.d.pause(1600);
    await ringWithText(c, reasons.getByRole('paragraph'), /Nothing here is ranked/, 'the order of the reasons', 'In the order they arrived');
  },

  async 'open-room'(c) {
    await c.d.clearHighlight();
    await openLiveRoom(c);
    await openPage(c, `${EARNING}/rooms`, 'Rooms', 'the rooms');
    await ringWithText(c, main(c).getByRole('paragraph').filter({ hasText: /drawn by lot/ }), /drawn by lot/, 'how rooms are drawn', 'Drawn by lot');
    await c.d.pause(2400);
    const mine = section(c, 'Your room');
    const members = mine.getByRole('paragraph').filter({ hasText: /^In the room:/ });
    await c.d.claimVisible(members, 'who is in her room');
    const names = ((await members.textContent()) ?? '').replace(/^In the room:\s*/, '').split(/,\s*/);
    c.d.claim(names.length === 6, `six people in the room (${names.join(', ')})`);
    await c.d.claimVisible(mine.getByText(/45 minutes left/), 'forty-five minutes');
    await c.d.highlight(mine, 'her room', 'Six people, forty-five minutes');
    await c.d.pause(2600);
    await c.d.clearHighlight();
    await c.d.click(mine.getByRole('link', { name: 'Join the room' }), 'Join the room');
    await c.d.claimVisible(roomMessage(c, 'Facilitator (AI)', /Welcome\. I am the facilitator/), 'the facilitator’s welcome');
  },

  async 'room-messages'(c) {
    const conversation = section(c, 'The conversation');
    await c.d.highlight(conversation.getByRole('heading', { name: 'The conversation' }), 'the room’s conversation');
    await c.d.pause(600);
    await c.d.clearHighlight();
    await toLatest(c);
    for (const line of LIVE_ROOM_LINES) {
      if (line.who === 'viewer') {
        // The facilitator has invited Amina in: she answers.
        const invite = roomMessage(c, 'Facilitator (AI)', /Amina, we have not heard from you yet/);
        c.d.claim(await until(async () => (await invite.count()) > 0, 8000), 'the facilitator invites Amina, who has not spoken');
        await toLatest(c);
        await c.d.highlight(invite, 'the facilitator inviting Amina', 'The facilitator invites her in');
        await c.d.pause(2200);
        await c.d.clearHighlight();
        await c.d.type(main(c).getByRole('textbox', { name: 'Your message' }), line.text, 'the message box', 20);
        await c.d.click(main(c).getByRole('button', { name: 'Send', exact: true }), 'Send', { settle: false });
        c.d.claim(await until(async () => (await roomMessages(c).filter({ hasText: line.text }).count()) > 0, 8000), 'Amina’s message is in the room');
        await toLatest(c);
        await c.d.pause(1200);
        continue;
      }
      await c.d.pause(900);
      await sayInRoom(c, line.who, line.text);
      // The room polls every 1.5 seconds, so the line arrives on screen by itself.
      c.d.claim(await until(async () => (await roomMessages(c).filter({ hasText: firstName(line.who) }).filter({ hasText: line.text }).count()) > 0, 8000), `${line.who}’s message arrives live`);
      await toLatest(c);
      await c.d.pause(1800);
    }
    // The facilitator asks whoever hasn't spoken yet, one at a time.
    c.d.claim(await until(async () => (await roomMessage(c, 'Facilitator (AI)', /Jo, we have not heard from you yet/).count()) > 0, 8000), 'the facilitator invites Jo, who has not spoken');
    await toLatest(c);
    await c.d.highlight(roomMessage(c, 'Facilitator (AI)', /Jo, we have not heard from you yet/), 'the facilitator inviting Jo', 'It never takes a side');
    await c.d.pause(1500);
  },

  async 'room-outcome'(c) {
    await c.d.clearHighlight();
    await openPage(c, `${EARNING}/rooms`, 'Rooms', 'the rooms');
    const found = section(c, 'What rooms found');
    const wording = found.getByRole('blockquote').filter({ hasText: /paid learning hours, with the cost shared between the employer and the skills fund/ });
    await c.d.claimVisible(wording, 'the earlier room’s new wording');
    await c.d.highlight(found.getByRole('heading', { level: 3 }).first(), 'the earlier room', 'An earlier room');
    await c.d.pause(1200);
    await c.d.highlight(wording, 'the new wording', 'New wording');
    await c.d.pause(3200);
    await c.d.clearHighlight();
    // Where a statement stands shows once she has answered it, so she answers the new wording too.
    await openStatement(c, /^Workers in roles their employer expects to change should get paid learning hours/, 'the new wording');
    const tags = main(c).getByRole('paragraph').filter({ hasText: /Version 2/ }).first();
    await c.d.claimVisible(tags, 'the new wording is version 2');
    await react(c, 'Agree');
    await c.d.claimVisible(tags.getByText('Common ground', { exact: true }), 'the new wording is common ground');
    await c.d.highlight(tags, 'the new wording, now common ground', 'Version 2, common ground');
  },

  async 'slow-room'(c) {
    await c.d.clearHighlight();
    await openPage(c, `${EARNING}/rooms`, 'Rooms', 'the rooms');
    const slow = section(c, 'Other rooms running or coming up').getByRole('listitem').filter({ hasText: 'Slow room' }).first();
    await c.d.claimVisible(slow, 'a slow room, open for days');
    await c.d.claimVisible(slow.getByText(/days? left/), 'the slow room says how many days are left');
    await c.d.highlight(slow, 'the slow room', 'Open for days');
    await c.d.pause(3600);
  },

  async 'talk-it-through'(c) {
    // The way in shows once she has answered the statement. She is not sure about this one.
    await openStatement(c, /^Everyone should be taught to use AI tools/, 'the statement on AI tools');
    await react(c, 'Not sure');
    const card = section(c, 'Talk it through');
    await c.d.claimVisible(card.getByText(/A short private conversation with the AI/), 'the way in to talk it through');
    await c.d.claimVisible(card.getByRole('link', { name: 'Talk it through' }), 'the talk it through button');
    await c.d.highlight(card, 'talk it through', 'In your own time');
    await c.d.pause(3800);
  },

  async 'open-statement-rule'(c) {
    await c.d.clearHighlight();
    await openPage(c, `${EARNING}/pledge`, 'The pledge', 'the pledge');
    const rule = section(c, /How it is decided/);
    await c.d.claimVisible(rule.getByText(/at least 60% of the people on each side agree/), 'the rule for deciding is in the pledge');
    await c.d.highlight(rule, 'the rule for deciding', 'Fixed in the pledge');
    await c.d.pause(3400);
    await openStatement(c, /^Nobody should have to lose pay to retrain/, 'the statement on losing pay to retrain');
    const needed = section(c, 'What is still needed');
    await c.d.claimVisible(needed.getByText(/below the level the pledge set \(13% agree, 60% needed\)/), 'what is still needed, in plain words');
    await c.d.highlight(needed, 'what the statement still needs', 'What it still needs');
  },

  async 'open-priorities'(c) {
    await c.d.clearHighlight();
    await openPage(c, `${EARNING}/priorities`, 'Which three matter most to you?', 'the priorities question');
    const choices = main(c).getByRole('group', { name: /reached common ground\. Choose up to three/ });
    await c.d.highlight(choices, 'the statements that passed', 'Which three matter most?');
  },

  async 'choose-priorities'(c) {
    const choices = main(c).getByRole('group', { name: /reached common ground/ });
    await c.d.clearHighlight();
    for (const [words, what] of [
      [/^People who work nights/, 'the shift-work statement'],
      [/^Skills people already have/, 'the skills statement'],
      [/^Workers in roles their employer expects to change/, 'the paid-hours statement'],
    ] as const) {
      await c.d.click(choices.getByRole('checkbox', { name: words }), what, { settle: false });
      await c.d.pause(350);
    }
    await c.d.claimVisible(main(c).getByText('3 of 3 chosen'), 'three chosen');
    await c.d.click(main(c).getByRole('button', { name: 'Save my choices' }), 'Save my choices');
    const list = section(c, 'The list so far');
    await c.d.claimVisible(list.getByText('32 of 49 invited people have chosen.'), 'the list counts her in');
    await ringWithText(c, list.getByRole('paragraph'), /32 of 49/, 'how many have chosen', 'Counted in');
    await c.d.pause(2200);
    await ringWithText(c, list.getByRole('paragraph'), /Once a large group.s first choice is placed, the other choices of the people who picked it count for less/, 'how the list is ordered', 'Smaller groups reach the top too');
  },

  async 'point-capacity'(c) {
    const list = section(c, 'The list so far');
    c.d.claim((await list.getByRole('listitem').count()) === 5, 'five priorities on the list');
    await c.d.highlight(list.getByRole('list'), 'the top five', 'The top five');
    await c.d.pause(2200);
    await ringWithText(c, list.getByRole('paragraph'), /answer the top 5 by 18 December 2026/, 'the reply date', 'Answered by 18 December');
  },

  async 'open-volunteering'(c) {
    await c.d.clearHighlight();
    await openPage(c, '/a/volunteering-tool', /shared volunteering tool do for volunteers/, 'the volunteering question');
    await ringWithText(c, c.d.page.getByRole('note').filter({ hasText: /invented/ }), /Example/, 'the example notice', 'A second invented example');
    await c.d.pause(2400);
    await ringWithText(c, main(c).getByRole('paragraph').first(), /Hosted by Northern Volunteer Centres Network/, 'the host', 'A network of volunteer centres');
    await c.d.pause(1600);
    await c.d.highlight(h1(c, /shared volunteering tool/), 'the question');
  },

  async 'open-decisions'(c) {
    await c.d.clearHighlight();
    await c.d.click(main(c).getByRole('link', { name: 'Read the decisions and answers' }), 'Read the decisions and answers');
    await c.d.claimVisible(h1(c, 'Decisions'), 'the decisions');
    const list = main(c).getByRole('list').first();
    c.d.claim((await list.getByRole('heading', { level: 2 }).count()) === 5, 'five decisions');
    // One of four words for each: accepted, changed, delayed or refused.
    for (const word of [/^Accepted\./, /^Changed:/, /^Delayed until/, /^Refused\./]) await c.d.claimVisible(list.getByRole('paragraph').filter({ hasText: word }), `an answer that says ${word}`);
    await c.d.highlight(list.getByRole('paragraph').filter({ hasText: /^Accepted\./ }).first(), 'an accepted decision', 'Accepted');
    await c.d.pause(1300);
    await c.d.highlight(list.getByRole('paragraph').filter({ hasText: /^Changed:/ }), 'a changed decision', 'Changed');
    await c.d.pause(1300);
    await c.d.highlight(list.getByRole('paragraph').filter({ hasText: /^Delayed until/ }), 'a delayed decision', 'Delayed');
    await c.d.pause(1300);
    await c.d.highlight(list.getByRole('paragraph').filter({ hasText: /^Refused\./ }), 'a refused decision', 'Refused, with reasons');
  },

  async 'open-refused'(c) {
    await c.d.clearHighlight();
    await c.d.click(main(c).getByRole('link', { name: /travel costs through the tool/ }), 'the travel costs decision');
    await c.d.claimVisible(h1(c, /travel costs through the tool/), 'the refused decision');
    await ringWithText(c, main(c).getByRole('paragraph'), /^Refused\s*on/, 'the refusal', 'Refused');
    await c.d.pause(1800);
    await ringWithText(c, main(c).getByRole('paragraph'), /no budget line for travel costs/, 'the reasons for refusing', 'Because there is no budget for it');
  },

  async 'open-decision-one'(c) {
    await c.d.clearHighlight();
    await c.d.click(main(c).getByRole('link', { name: 'A shared volunteering tool' }), 'back to the decisions');
    await c.d.click(main(c).getByRole('link', { name: /proves who they are once/ }), 'decision 1');
    await c.d.claimVisible(h1(c, /proves who they are once and can share that proof with any group they choose/), 'decision 1');
    await c.d.highlight(h1(c, /proves who they are once/), 'decision 1');
    await c.d.pause(2000);
    await ringWithText(c, main(c).getByRole('paragraph'), /^Accepted\s*on/, 'the answer', 'Accepted');
  },

  async 'highlight-tests'(c) {
    await c.d.clearHighlight();
    const tests = section(c, /Tests for/).getByRole('list').first();
    c.d.claim((await tests.getByRole('listitem').count()) === 3, 'three numbered tests');
    await c.d.claimVisible(tests.getByRole('listitem').filter({ hasText: /^1\.\s*A volunteer checked by one group/ }), 'the tests are numbered');
    await c.d.highlight(tests, 'the numbered tests', 'Numbered tests for “done”');
    await c.d.pause(2600);
    await ringWithText(c, main(c).getByRole('paragraph'), /Anyone who took part should be able to check each of these/, 'who can check them', 'Checkable by the people who decided');
  },

  async 'open-proposal'(c) {
    await c.d.clearHighlight();
    const plans = main(c).getByRole('heading', { level: 2, name: 'How it will be built' }).locator('xpath=following-sibling::*[1]');
    const chosen = plans.getByRole('listitem').filter({ hasText: /Chosen plan/ }).first();
    await c.d.claimVisible(chosen.getByText(/Confirmed faithful to the decision/), 'the plan was confirmed faithful to the decision');
    await c.d.highlight(chosen.getByText(/Chosen plan/).first(), 'the chosen plan', 'Confirmed faithful to the decision');
    await c.d.pause(2600);
    await c.d.clearHighlight();
    await c.d.click(chosen.getByText('The plan', { exact: true }), 'The plan', { settle: false });
    const agents = chosen.getByText(/written with AI coding agents/);
    await c.d.claimVisible(agents, 'the plan says AI coding agents write much of the code');
    await c.d.highlight(agents, 'the plan’s building and accountability', 'AI agents build, a named person answers for it');
    await c.d.pause(3000);
    await c.d.claimVisible(main(c).getByText(/Owner: Nkechi, Kestrel Lane Co-operative/).first(), 'a named owner for each piece');
  },

  async 'open-check'(c) {
    await c.d.clearHighlight();
    const check = section(c, 'The check');
    const panel = check.getByRole('paragraph').filter({ hasText: /Check panel of five participants drawn by lot/ });
    await c.d.claimVisible(panel, 'a panel drawn by lot did the check');
    const results = check.getByRole('list').first();
    for (const [n, met] of [[1, 'met'], [2, 'not met'], [3, 'met']] as const) await c.d.claimVisible(results.getByRole('listitem').filter({ hasText: new RegExp(`Test ${n}: ${met}\\.`) }), `test ${n} ${met}`);
    await c.d.highlight(panel, 'the check panel', 'Checked by a panel drawn by lot');
    await c.d.pause(2600);
    await c.d.highlight(results, 'the tests checked', 'Two met, one not');
    await c.d.pause(3000);
    await ringWithText(c, check.getByRole('paragraph'), /^Delivered with small changes\. Tests 1 and 3 are met/, 'what the panel said', 'Delivered, with small changes');
  },

  async 'open-register'(c) {
    await c.d.clearHighlight();
    await c.d.click(c.d.page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Register' }), 'the Register link');
    await c.d.claimVisible(h1(c, 'The register'), 'the register');
    const summary = main(c).getByRole('paragraph').filter({ hasText: /^5 decisions:/ });
    await c.d.claimVisible(summary.filter({ hasText: '1 delivered with small changes, 2 in progress, 1 delayed, 1 refused' }), 'the statuses in the register');
    await ringWithText(c, main(c).getByRole('paragraph'), /Every decision in every assembly/, 'the register explained', 'One public register');
    await c.d.pause(2200);
    await c.d.highlight(main(c).getByRole('table', { name: 'Decisions in the register' }), 'the decisions and their status');
  },

  async 'point-in-progress'(c) {
    await c.d.clearHighlight();
    await c.d.highlight(main(c).getByRole('cell', { name: 'In progress', exact: true }).first(), 'a decision in progress', 'In progress');
    await c.d.pause(1600);
    await ringWithText(c, main(c).getByRole('paragraph'), /In progress is not counted as done/, 'how the register counts', 'Never counted as done');
    await c.d.pause(5200);
    await ringWithText(c, main(c).getByRole('paragraph'), /only counts as delivered when someone other than the host has checked it/, 'who checks', 'Someone else does the checking');
  },

  async 'open-me'(c) {
    await c.d.clearHighlight();
    await c.d.click(c.d.page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Me', exact: true }), 'the Me link');
    await c.d.claimVisible(h1(c, 'What happened to what I said'), 'her own page');
    const hers = main(c).getByRole('list', { name: 'Your points' }).getByRole('listitem').filter({ hasText: 'at work or asleep' }).first();
    await c.d.claimVisible(hers.getByRole('link', { name: /On when I.m at work or asleep/ }), 'her point traced to its theme');
    await c.d.claimVisible(hers.getByRole('link', { name: /People who work nights or rotating shifts/ }), 'her point traced to a statement');
    await c.d.highlight(hers, 'her point, traced', 'Her point, traced');
  },

  async 'open-listening'(c) {
    await c.d.clearHighlight();
    await openPage(c, '/listening', 'Open listening', 'open listening');
    await ringWithText(c, main(c).getByRole('paragraph'), /Anyone can take part, with no host and no deadline/, 'who can take part', 'Anyone, no host');
    await c.d.pause(2600);
    await c.d.pointAt(main(c).getByRole('link', { name: 'Start my conversation' }), 'the Start my conversation link');
  },

  async 'point-languages'(c) {
    await c.d.clearHighlight();
    const reach = main(c).getByRole('paragraph').filter({ hasText: /^60 people/ });
    await c.d.claimVisible(reach.filter({ hasText: /in 14 countries/ }), 'sixty people in fourteen countries');
    await ringWithText(c, main(c).getByRole('paragraph'), /^60 people/, 'how many people, and where', 'Fourteen countries');
    await c.d.pause(2400);
    await ringWithText(c, c.d.page.getByRole('note').filter({ hasText: /invented/ }), /Example/, 'the example notice', 'All invented');
  },

  async 'point-no-host'(c) {
    await c.d.clearHighlight();
    const noHost = section(c, 'Themes with no host yet');
    await c.d.claimVisible(noHost.getByText(/Nobody has opened an assembly to act on these/), 'themes nobody is responsible for');
    await c.d.highlight(noHost.getByRole('heading', { name: 'Themes with no host yet' }), 'the themes with no host', 'Nobody responsible yet');
    await c.d.pause(2600);
    const care = main(c).getByRole('listitem').filter({ has: c.d.page.getByRole('heading', { level: 3, name: /Looking after my mum and working full time/ }) });
    await c.d.highlight(care, 'the theme about caring for a parent while working', 'Caring for a parent, and a job');
  },

  async 'open-ai-and-care'(c) {
    await c.d.clearHighlight();
    const care = main(c).getByRole('listitem').filter({ has: c.d.page.getByRole('heading', { level: 3, name: /Looking after my mum/ }) });
    await c.d.click(care.getByRole('link', { name: 'AI and care' }), 'the AI and care assembly');
    await c.d.claimVisible(h1(c, /what should AI do and what should stay with humans/), 'the AI and care assembly');
    await ringWithText(c, main(c).getByRole('paragraph'), /Opened after a theme in open listening kept coming back/, 'why it opened', 'Someone stepped forward');
    await c.d.pause(2400);
    await c.d.clearHighlight();
    await c.d.click(main(c).getByRole('link', { name: 'Read the pledge' }), 'Read the pledge');
    await ringWithText(c, section(c, 'What the host can act on'), /unions, providers and family carer groups/, 'who is in the coalition', 'Care workers, providers, family carers');
    await c.d.pause(2400);
    // Published on 8 November; challengeable until 22 November, nine days from today.
    await ringWithText(c, main(c).getByRole('paragraph'), /It could be challenged until 22 November 2026/, 'the challenge period', 'Nine more days to challenge it');
  },

  async 'open-feedback'(c) {
    await c.d.clearHighlight();
    const give = c.d.page.getByRole('link', { name: 'Give feedback' });
    await c.d.highlight(give, 'the feedback button', 'On every page');
    await c.d.pause(2000);
    await c.d.clearHighlight();
    await c.d.click(give, 'Give feedback');
    await c.d.claimVisible(h1(c, 'Give feedback'), 'the feedback page');
    await c.d.click(main(c).getByRole('button', { name: /Answer a few questions/ }), 'the guided questions');
    await c.d.claimVisible(main(c).getByRole('listitem').filter({ hasText: /What were you trying to do in Unite today/ }), 'the first question');
  },

  async 'feedback-answer'(c) {
    const box = main(c).getByRole('textbox', { name: 'Your answer' });
    const recorded = section(c, 'What we have recorded so far');
    const sendAndWait = async (text: string, next: RegExp) => {
      await c.d.type(box, text, 'the answer box', 22);
      await c.d.click(main(c).getByRole('button', { name: 'Send', exact: true }), 'Send', { settle: false });
      c.d.claim(await until(async () => (await recorded.getByText(text).count()) > 0 && (await main(c).getByText(next).count()) > 0, 10_000), `the answer is recorded and the next question asked`);
    };
    await sendAndWait('Have my say about night classes, then see what others said.', /What happened when you tried/);
    await sendAndWait('It worked. I stopped early when my break ended.', /Unite asked:/);
    await c.d.highlight(recorded, 'what has been recorded so far', 'What you said, always on screen');
    await c.d.pause(2400);
    await c.d.clearHighlight();
    // She changes an answer.
    await c.d.click(recorded.getByRole('button', { name: 'Change your answer to: What happened when you tried?' }), 'Change, on her second answer');
    const edit = recorded.getByRole('textbox', { name: /Your answer to: What happened when you tried/ });
    if (await c.d.click(edit, 'her second answer', { settle: false })) {
      await edit.press('ControlOrMeta+End');
      await edit.pressSequentially(' I came back to finish on the bus.', { delay: c.d.fast ? 0 : 60 });
    }
    await c.d.click(recorded.getByRole('button', { name: 'Save' }), 'Save');
    await c.d.claimVisible(recorded.getByText(/came back to finish on the bus/), 'her changed answer');
  },

  async 'open-your-feedback'(c) {
    const panel = main(c).getByRole('complementary', { name: 'Your answers' });
    await c.d.click(panel.getByRole('button', { name: 'Submit what I have said so far' }), 'Submit what I have said so far');
    const thanks = panel.getByRole('link', { name: 'See your feedback' });
    await c.d.claimVisible(thanks, 'the feedback is sent');
    await c.d.click(thanks, 'See your feedback');
    await c.d.claimVisible(h1(c, 'Your feedback'), 'her private feedback page');
    await c.d.highlight(main(c).getByRole('heading', { level: 2, name: /What is happening with it/ }), 'what is happening with her feedback', 'Her private link');
    await c.d.pause(3200);
    await openPage(c, '/a/making-unite-better/pledge', 'The pledge', 'the pledge of the people who run Unite');
    await c.d.claimVisible(main(c).getByRole('note').filter({ hasText: /Draft/ }), 'the pledge is still a draft');
    await ringWithText(c, section(c, 'When the host will answer'), /answer the top 3 priorities by 26 February 2027/, 'when they answer', 'They answer by a date');
    await c.d.pause(2400);
    await ringWithText(c, section(c, 'Who checks it was done'), /The host cannot mark its own work as done/, 'who checks', 'Someone else checks');
  },

  async 'open-how'(c) {
    await openPage(c, '/how', 'How Unite works', 'How Unite works');
    const links = main(c)
      .getByRole('list')
      .filter({ has: c.d.page.getByRole('link', { name: /rules Unite/ }) })
      .filter({ has: c.d.page.getByRole('link', { name: /prompt the AI is given/ }) });
    await c.d.scroll(1400);
    await ringWithText(c, links, /word for word/, 'the rules and the prompts', 'The rules and every prompt, published');
    await c.d.pause(2400);
    await c.d.clearHighlight();
    // "...and the record of every assembly": the public register.
    await c.d.pointAt(c.d.page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Register' }), 'the Register link');
  },

  async 'end-card'(c) {
    await c.d.clearHighlight();
    await c.d.chapter({ eyebrow: 'Unite', title: 'Start a conversation.', sub: 'A first real question, with a host ready to promise an answer.' }, 0);
    await c.d.pause(2500);
  },
} satisfies Record<string, Action>;

/** Actions named in narration.md whose pages are still being built. */
export const PENDING_ACTIONS = [] as const;

export type PendingAction = (typeof PENDING_ACTIONS)[number];
export type ActionName = keyof typeof implemented | PendingAction;

export class PendingActionError extends Error {}

/** A placeholder for an action that isn't written yet: a plain card in a draft, a failure otherwise. */
export function pending(name: PendingAction): Action {
  return async (c) => {
    if (c.strict) throw new PendingActionError(`"${name}" is a pending action: its scene isn't wired up yet`);
    await c.d.clearHighlight();
    await c.d.chapter({ eyebrow: 'Pending scene', title: name, sub: 'This shot is recorded once its page is built.' }, 0);
  };
}

export const actions: Record<ActionName, Action> = {
  ...implemented,
  ...(Object.fromEntries(PENDING_ACTIONS.map((n) => [n, pending(n)])) as Record<PendingAction, Action>),
};

export const isPending = (name: string): name is PendingAction => (PENDING_ACTIONS as readonly string[]).includes(name);

/** Actions a script names that scenes.ts doesn't define, as "scene: action". */
export function unknownActions(n: Narration) {
  return n.scenes.flatMap((s) =>
    s.steps
      .flatMap((st) => [...st.actions, ...st.after, ...st.marks.map((m) => m.action)])
      .filter((a) => !Object.hasOwn(actions, a.name))
      .map((a) => `${s.id}: ${a.name}`),
  );
}
