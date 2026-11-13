/**
 * What happens on screen. Each action is named in narration.md as [do: name] or
 * [then: name], and drives the built demonstration being recorded.
 *
 * Every action checks that what its paragraph says is really on screen (d.claim and
 * d.claimVisible), and finds elements by role and text, never by position, so a renamed
 * button is a warning (and fails --strict) rather than a ring around the wrong thing.
 */
import type { Locator } from 'playwright';
import { sleep, type Director } from './lib/director.ts';
import type { Narration } from './lib/narration.ts';

export interface Ctx {
  d: Director;
  /** The recorded site's origin, e.g. http://127.0.0.1:43121 */
  url: string;
  strict: boolean;
  /** The scene being recorded, and its place among the recorded scenes. */
  scene?: { id: string; title: string };
  chapterNo?: number;
  chapterCount?: number;
}

export type Action = (ctx: Ctx, args: string[]) => Promise<void>;

const main = (c: Ctx) => c.d.page.getByRole('main');
const h1 = (c: Ctx, name: RegExp | string) => main(c).getByRole('heading', { level: 1, name });
const btn = (c: Ctx, name: RegExp | string, exact = false) => main(c).getByRole('button', { name, exact });
/** A <section> of the page, found by the id of its labelling heading. */
const labelled = (c: Ctx, id: string) => main(c).locator(`section[aria-labelledby="${id}"]`);
const part = (c: Ctx, n: number) => labelled(c, `part-${n}`);

/** Scrolls smoothly to something, glides the pointer to it, and rings it. */
async function look(c: Ctx, target: Locator, what: string, opts: { tag?: string; text?: RegExp | string } = {}) {
  const t = opts.text ? target.filter({ hasText: opts.text }) : target;
  if (opts.text) await c.d.claimVisible(t, `${what} says ${opts.text}`);
  const l = await c.d.reveal(t, what);
  if (!l) return undefined;
  await c.d.aim(l);
  await c.d.ring(l, what, opts.tag);
  return l;
}

/** One line under each chapter title on its card. */
const CARD_SUB: Record<string, string> = {
  welcome: 'A demonstration on invented examples. Every person, host and number in this video is invented.',
  conversation: 'A private conversation about a real day, in your own language.',
  phone: 'The phone route, as a mock-up.',
  picture: 'Five parts at every layer, and two counts on every finding.',
  difference: 'What the picture keeps, instead of averaging away.',
  days: 'Ordinary good days, in people’s own words.',
  room: 'A slow room of seven people drawn by lot.',
  answers: 'Invented example hosts, and a public register.',
  route: 'Rehema, an invented example, with a basic phone.',
  feedback: 'Tell us what made sense, and what didn’t.',
};

export const actions = {
  /** The chapter card, with the scene's opening page loaded behind it. */
  chapter: async (c, args) => {
    const path = args[0] ?? '/';
    const welcome = c.scene?.id === 'welcome';
    const eyebrow = welcome ? 'Edition 0 · demonstration' : c.chapterNo && c.chapterCount ? `The Common Picture · ${c.chapterNo} of ${c.chapterCount}` : 'The Common Picture';
    const title = welcome ? 'The Common Picture' : (c.scene?.title ?? '');
    await c.d.chapter({ eyebrow, title, sub: CARD_SUB[c.scene?.id ?? ''] ?? '' }, 0);
    await c.d.pause(welcome ? 3000 : 1300);
    await c.d.goto(`${c.url}${path}`, { keepCard: true });
    await c.d.page.evaluate(() => window.__wt?.hideChapter());
  },

  /* ------------------------------------------------------------------ welcome */
  'home-pitch': async (c) => {
    await look(c, h1(c, /standing, public picture of the lives people want/), 'the pitch');
  },
  'home-answer': async (c) => {
    await look(c, main(c).locator('.lede'), 'the one ask', { text: 'answer it in public' });
  },
  'home-strip': async (c) => {
    await look(c, c.d.page.getByRole('note', { name: 'Example data' }), 'the example-data strip', { text: 'Demonstration on invented examples' });
  },
  'home-working-name': async (c) => {
    await look(c, c.d.page.locator('footer p'), 'the working-name note', { text: '‘The Common Picture’ is a working name.' });
  },

  /* ------------------------------------------------------------------ the conversation */
  'pick-language': async (c) => {
    await c.d.claimVisible(h1(c, 'The conversation'), 'the conversation page');
    await c.d.click(main(c).getByRole('radio', { name: /Kiswahili/ }), 'Kiswahili', { settle: false });
    await c.d.pause(500);
    await c.d.click(main(c).getByRole('radio', { name: /Type or speak on the web/ }), 'the web route', { settle: false });
    await c.d.claim(await main(c).getByRole('radio', { name: /Type or speak on the web/ }).isChecked(), 'the web route is chosen');
    await c.d.pause(500);
    await c.d.click(btn(c, 'Begin'), 'Begin');
  },
  'begin-chat': async (c) => {
    await look(c, main(c).locator('.bubble.ai').first(), 'the interviewer’s first words', { text: 'I am an AI interviewer, not a person.' });
    await c.d.pause(2300);
    await look(c, main(c).locator('.bubble.ai').nth(1), 'the first question', { text: 'Tell me about yesterday' });
    await c.d.claimVisible(main(c).getByText('Tuanze na siku halisi.', { exact: false }), 'the question in Kiswahili');
  },
  'example-answers': async (c) => {
    const ex = btn(c, 'Use an example answer');
    await c.d.pointAt(ex, 'Use an example answer');
    await c.d.ring(ex, 'Use an example answer');
    await c.d.pause(500);
    await c.d.click(ex, 'Use an example answer', { settle: false });
    await c.d.pause(700);
    await c.d.click(ex, 'Use an example answer', { settle: false });
    await c.d.claimVisible(main(c).locator('.bubble.ai', { hasText: 'What got in the way' }), 'the third question');
  },
  'type-money': async (c) => {
    await c.d.clearHighlight();
    await c.d.type(main(c).getByLabel(/Your answer/), 'Money, mostly.', 'the answer box', 12);
    await c.d.pause(300);
    await c.d.click(btn(c, 'Send answer'), 'Send answer');
  },
  'show-follow-up': async (c) => {
    await look(c, main(c).locator('.bubble.ai').last(), 'the follow-up question', { text: 'You said “money”. Can you tell me about a time that showed up in your day?' });
  },
  'finish-answers': async (c) => {
    const ex = btn(c, 'Use an example answer');
    for (let i = 0; i < 4; i++) {
      if (await main(c).getByRole('heading', { name: 'Here is what I heard' }).isVisible()) break;
      await c.d.click(ex, 'Use an example answer', { settle: false });
      await c.d.pause(450);
    }
    await c.d.claimVisible(main(c).getByRole('heading', { name: 'Here is what I heard' }), 'the read-back');
  },
  'show-heard': async (c) => {
    await look(c, labelled(c, 'heard').locator('h2, p').first(), 'Here is what I heard');
    await c.d.pause(1200);
    await look(c, labelled(c, 'heard').locator('p.muted'), 'the note on own words', { text: 'These are your own words' });
  },
  'change-and-drop': async (c) => {
    const keep = btn(c, 'Keep point 1');
    await look(c, keep, 'Keep point 1');
    await c.d.pause(500);
    await c.d.click(btn(c, 'Change point 2'), 'Change point 2', { settle: false });
    const box = main(c).getByLabel('Change point 2 to say');
    await c.d.type(box, 'The bus fare went up again, and I lost an hour of selling.', 'the change box', 22);
    await c.d.pause(400);
    await c.d.click(btn(c, 'Drop point 5'), 'Drop point 5', { settle: false });
    await look(c, main(c).locator('li.point.dropped'), 'the dropped point');
    await c.d.claim((await btn(c, 'Drop point 5').getAttribute('aria-pressed')) === 'true', 'point 5 is dropped');
  },
  'show-consent': async (c) => {
    await c.d.click(btn(c, /Continue with 4 kept points/), 'Continue');
    await c.d.claimVisible(main(c).getByRole('heading', { name: 'Adding to the picture' }), 'the consent step');
    await look(c, labelled(c, 'consent').locator('ul'), 'what happens to your words', { text: 'Your words in your language are the record' });
  },
  'add-points': async (c) => {
    await c.d.click(main(c).getByRole('checkbox', { name: 'Add my kept points to the picture for Kisumu, Kenya' }), 'the consent box', { settle: false });
    await c.d.pause(500);
    await c.d.click(btn(c, 'Add my points'), 'Add my points');
    await look(c, labelled(c, 'done'), 'the confirmation', { text: 'In this demonstration nothing is stored.' });
  },

  /* ------------------------------------------------------------------ phone */
  'phone-mockup': async (c) => {
    await c.d.click(main(c).getByRole('radio', { name: /An ordinary phone call/ }), 'the phone route');
    await c.d.pause(300);
    await c.d.click(btn(c, 'Begin'), 'Begin');
    await look(c, main(c).locator('.notice'), 'the mock-up notice', { text: 'The phone route does not work in this demonstration.' });
  },
  'phone-callback': async (c) => {
    await look(c, main(c).locator('.phone-script li'), 'the free callback', { text: 'A free callback' });
  },
  'phone-keypad': async (c) => {
    await look(c, main(c).locator('.phone-script li'), 'keep, change or drop', { text: 'Keep, change or drop by voice or keypad' });
  },

  /* ------------------------------------------------------------------ the picture */
  'picture-world': async (c) => {
    await c.d.claimVisible(main(c).getByRole('heading', { level: 2, name: 'The world picture' }), 'the world layer');
    await look(c, labelled(c, 'layer-title').locator('p').first(), 'the world picture’s size', { text: 'Built from 162 invented conversations' });
  },
  'picture-layers': async (c) => {
    await look(c, main(c).locator('.layer-picker'), 'the layer picker', { text: 'Quechua-speaking circle' });
  },
  'picture-five-parts': async (c) => {
    await look(c, main(c).locator('.lede'), 'the five parts', { text: 'Every layer has the same five parts.' });
  },
  'first-finding': async (c) => {
    await look(c, part(c, 1).locator('article').first(), 'the first finding', { text: 'Time with the people I love, while it is still light' });
  },
  'both-counts': async (c) => {
    await look(c, part(c, 1).locator('article').first().locator('.count-box.drawn'), 'the two counts', { text: '61% of people · 6 of 6 places and circles' });
  },
  'two-doors': async (c) => {
    await look(c, part(c, 1).locator('article').first().locator('.counts.both'), 'both doors', { text: 'Open door' });
  },
  'rests-on': async (c) => {
    await look(c, part(c, 1).locator('article').first().locator('.count-box.rests'), 'the door it rests on', { text: 'Drawn sample · rests on this' });
  },
  'open-words': async (c) => {
    const first = part(c, 1).locator('article').first();
    await c.d.click(first.getByRole('button', { name: /Show the words behind this/ }), 'Show the words behind this', { settle: false });
    await sleep(400);
    await look(c, first.locator('.quote'), 'a quote with its labelled translation', { text: 'Translated from Kiswahili' });
  },

  /* ------------------------------------------------------------------ keeping difference */
  'said-differently': async (c) => {
    await look(c, part(c, 2).locator('article').first(), 'the first said-differently set', { text: 'What place work has in a good day' });
  },
  'standing-statement': async (c) => {
    await look(c, part(c, 3).locator('figure.standing'), 'the standing statement', { text: 'An invented Quechua-speaking community near Cusco' });
    await c.d.claimVisible(part(c, 3).getByText('Standing statement · shown whole, never summarised'), 'shown whole, never summarised');
  },
  'standing-framing': async (c) => {
    await look(c, part(c, 3).locator('figure.standing .notice'), 'how a standing statement would appear', { text: 'Real ones are written by communities through their own process' });
  },
  'in-tension': async (c) => {
    await look(c, part(c, 4).locator('article').first(), 'the first tension', { text: "A grower's fair price is a city family's food bill" });
  },
  'not-yet-heard': async (c) => {
    await look(c, part(c, 5).locator('.grid'), 'who is missing', { text: 'By language' });
  },
  'open-challenge': async (c) => {
    const b = part(c, 5).getByRole('button', { name: 'This is not what was said' });
    await c.d.reveal(part(c, 5).locator('.part-head'), 'the part 5 heading');
    await c.d.click(b, 'This is not what was said', { settle: false });
    await sleep(400);
    await look(c, part(c, 5).locator('.nws-form'), 'the challenge form', { text: 'What was said instead?' });
  },
  'send-challenge': async (c) => {
    await c.d.click(part(c, 5).getByRole('button', { name: 'Send challenge' }), 'Send challenge', { settle: false });
    await sleep(300);
    await look(c, part(c, 5).locator('.nws-form'), 'the challenge acknowledgement', { text: 'In this demonstration nothing was sent.' });
    await c.d.claimVisible(part(c, 5).getByText('marked as challenged', { exact: false }), 'marked as challenged');
  },
  'retention-test': async (c) => {
    await look(c, main(c).locator('.notice.blue'), 'the retention test', { text: '7 of 8 distinct minority themes' });
    await c.d.claimVisible(main(c).locator('.notice.blue').getByText(/threshold in the charter: 6 of 8/), 'the threshold');
  },
  'open-kisumu': async (c) => {
    await c.d.reveal(main(c).locator('.layer-picker'), 'the layer picker');
    await c.d.click(main(c).locator('.layer-picker').getByRole('button', { name: 'Kisumu', exact: true }), 'Kisumu', { settle: false });
    await c.d.claimVisible(main(c).getByRole('heading', { level: 2, name: 'Kisumu, Kenya' }), 'the Kisumu layer');
    await look(c, labelled(c, 'layer-title').locator('p').first(), 'Kisumu’s size', { text: 'Built from 30 invented conversations' });
  },
  'kisumu-reply': async (c) => {
    await look(c, main(c).locator('aside.reply'), 'the right of reply', { text: 'Right of reply from an invented market traders’ group in Kisumu' });
    await c.d.claimVisible(main(c).locator('aside.reply').getByText('Translated from Kiswahili'), 'the reply in Kiswahili');
  },

  /* ------------------------------------------------------------------ good days */
  'days-intro': async (c) => {
    await c.d.claimVisible(h1(c, 'Good days from elsewhere'), 'the good days page');
    await look(c, main(c).locator('.lede'), 'the good days lede', { text: 'nothing to like or share' });
  },
  'days-care': async (c) => {
    await c.d.click(main(c).getByRole('button', { name: 'Care', exact: true }), 'the Care filter', { settle: false });
    await sleep(300);
    await look(c, labelled(c, 'm-Care'), 'days about care', { text: 'Care' });
  },

  /* ------------------------------------------------------------------ the slow room */
  'room-intro': async (c) => {
    await c.d.claimVisible(h1(c, "A grower's fair price is a city family's food bill"), 'the slow room');
    await look(c, main(c).locator('.lede'), 'the room lede', { text: 'The room decides nothing' });
  },
  'room-days': async (c) => {
    await look(c, labelled(c, 'room-facts'), 'the days the room is open', { text: 'Day 3 of 7' });
  },
  'room-stand': async (c) => {
    await look(c, labelled(c, 'stand').locator('form'), 'write where you stand first', { text: 'The others’ messages stay hidden until you post yours.' });
  },
  'room-post': async (c) => {
    await c.d.click(labelled(c, 'stand').getByRole('button', { name: 'Use an example answer' }), 'Use an example answer', { settle: false });
    await sleep(400);
    await c.d.claimVisible(main(c).getByText('Seat 7 · Dhaka'), 'the others’ messages');
    await look(c, labelled(c, 'stand').locator('article.msg').nth(1), 'another seat’s message', { text: 'writes in' });
  },
  'talk-intro': async (c) => {
    await look(c, labelled(c, 'talk-h').locator('p').filter({ hasText: 'A private conversation on one statement' }), 'Talk it through', { text: 'It gives no view of its own' });
  },
  'talk-agree': async (c) => {
    const s = labelled(c, 'talk-h');
    await c.d.click(s.getByRole('button', { name: 'Talk it through' }), 'Talk it through', { settle: false });
    await sleep(400);
    await c.d.click(s.getByRole('button', { name: 'I agree' }), 'I agree', { settle: false });
    await sleep(400);
    await c.d.claimVisible(s.getByText('Here are reasons given by people who answered differently', { exact: false }), 'reasons from people who answered differently');
    await look(c, s.locator('.grid figure').first(), 'a translated reason', { text: 'Translated from' });
  },
  'talk-what-true': async (c) => {
    await look(c, labelled(c, 'talk-h').locator('.bubble.ai').last(), 'the go-between’s question', { text: 'What, if anything, is true in this for you?' });
  },

  /* ------------------------------------------------------------------ answers */
  'answers-intro': async (c) => {
    await c.d.claimVisible(h1(c, 'Pledges and the register'), 'the answers page');
    await look(c, main(c).locator('.lede'), 'the answers lede', { text: 'pledge to answer it in public, by a date' });
  },
  'answers-notice': async (c) => {
    await look(c, main(c).locator('.notice'), 'the invented-hosts notice', { text: 'Every host on this page is an invented example host.' });
  },
  'answers-host': async (c) => {
    await look(c, labelled(c, 'hosts').locator('article').first(), 'the first host', { text: 'An invented county government in western Kenya' });
    await c.d.claimVisible(labelled(c, 'hosts').getByText(/by 30 June 2027/), 'answer by 30 June');
  },
  'answers-ask': async (c) => {
    await look(c, labelled(c, 'asks').locator('article').first(), 'the first ask', { text: 'The main market road can be used the morning after heavy rain.' });
  },
  'answers-no-assembly': async (c) => {
    await look(c, labelled(c, 'asks').locator('p.muted'), 'no assembly has decided anything', { text: 'no assembly has met or decided anything' });
  },
  'answers-register': async (c) => {
    await look(c, labelled(c, 'register'), 'the register', { text: 'Late · 14 days' });
  },
  'answers-check': async (c) => {
    await look(c, labelled(c, 'panel'), 'the check panel', { text: 'A host cannot mark its own work.' });
  },

  /* ------------------------------------------------------------------ Rehema's route */
  'route-intro': async (c) => {
    await c.d.claimVisible(h1(c, 'One person’s route'), 'the route page');
    await look(c, main(c).locator('.lede'), 'Rehema', { text: 'has a basic phone' });
  },
  'route-callback': async (c) => {
    await c.d.reveal(main(c).locator('.timeline li').filter({ hasText: 'She rings and hangs up' }), 'step 2');
    await c.d.pause(600);
    await look(c, main(c).locator('.timeline li'), 'the free callback', { text: 'It calls her back, free' });
  },
  'route-readback': async (c) => {
    await look(c, main(c).locator('.timeline li'), 'the read-back', { text: 'Twelve minutes later it reads back four points' });
    await c.d.claimVisible(main(c).getByText('She keeps three by pressing 1', { exact: false }), 'keeps three, changes one');
  },

  /* ------------------------------------------------------------------ feedback and close */
  'feedback-button': async (c) => {
    await look(c, c.d.page.getByRole('banner').getByRole('link', { name: 'Give feedback' }), 'the Give feedback button');
  },
  'feedback-who': async (c) => {
    await c.d.click(c.d.page.getByRole('banner').getByRole('link', { name: 'Give feedback' }), 'Give feedback');
    await c.d.claimVisible(h1(c, 'Give feedback'), 'the feedback page');
    await look(c, main(c).locator('.who-reads').first(), 'who can read your feedback', { text: 'Nobody else.' });
  },
  'feedback-choices': async (c) => {
    await look(c, main(c).getByRole('region', { name: 'Choose how to give feedback' }), 'the two ways to give feedback', { text: 'Just tell us something' });
    await c.d.claimVisible(btn(c, /about 4 minutes/), 'about four minutes');
  },
  'feedback-guided': async (c) => {
    await c.d.click(btn(c, /A few guided questions/), 'A few guided questions', { settle: false });
    await sleep(300);
    await c.d.click(main(c).getByRole('radio', { name: 'Someone who might take part' }), 'an answer', { settle: false });
    await c.d.pause(300);
    await look(c, btn(c, 'Send what I’ve said so far'), 'Send what I’ve said so far');
  },
  'feedback-send': async (c) => {
    await c.d.click(btn(c, 'Send what I’ve said so far'), 'Send what I’ve said so far');
    await c.d.claimVisible(main(c).getByRole('heading', { name: 'Thank you' }), 'the thank-you');
    await look(c, main(c).getByRole('status'), 'the thank-you', { text: 'Your feedback reached the people building this demonstration.' });
  },
  'about-not-shown': async (c) => {
    await c.d.click(c.d.page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'About', exact: true }), 'About');
    await c.d.claimVisible(h1(c, 'What this demonstration is and is not'), 'the About page');
    await look(c, labelled(c, 'not'), 'what it does not show', { text: 'That any institution will answer.' });
    await c.d.claimVisible(labelled(c, 'not').getByText('The phone and radio routes working for real.', { exact: false }), 'phone routes not real');
  },
  'closing-line': async (c) => {
    await look(c, main(c).locator('p'), 'the closing line', { text: 'A demonstration of method and nothing more.' });
  },
  'end-card': async (c) => {
    await c.d.clearHighlight();
    await c.d.chapter({ eyebrow: 'Edition 0 · demonstration', title: 'The Common Picture', sub: 'Every person, host and number in this video is invented. ‘The Common Picture’ is a working name.' }, 0);
  },
} satisfies Record<string, Action>;

export type ActionName = keyof typeof actions;

/** Actions the script names that this file doesn't define. */
export function unknownActions(n: Narration): string[] {
  const names = new Set(Object.keys(actions));
  const used = n.scenes.flatMap((s) => s.steps.flatMap((st) => [...st.actions, ...st.after, ...st.marks.map((m) => m.action)]).map((a) => `${s.id}: ${a.name}`));
  return used.filter((u) => !names.has(u.split(': ')[1]));
}
