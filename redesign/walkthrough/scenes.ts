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
import type { Director } from './lib/director.ts';
import type { Narration } from './lib/narration.ts';

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
  await c.d.highlight(target, what, tag);
}

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

  async 'open-how'(c) {
    await openPage(c, '/how', 'How Unite works', 'How Unite works');
    const links = main(c)
      .getByRole('list')
      .filter({ has: c.d.page.getByRole('link', { name: /rules Unite/ }) })
      .filter({ has: c.d.page.getByRole('link', { name: /prompt the AI is given/ }) });
    await c.d.scroll(1400);
    await ringWithText(c, links, /word for word/, 'the rules and the prompts', 'The rules and every prompt, published');
    await c.d.pause(2400);
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
export const PENDING_ACTIONS = [
  'start-conversation',
  'show-consent',
  'answer-real-day',
  'answer-mattered',
  'answer-expensive',
  'answer-good-day',
  'show-stage-names',
  'open-review',
  'edit-point',
  'approve-points',
  'open-picture',
  'point-her-theme',
  'open-sources',
  'point-not-what-was-said',
  'point-who-is-missing',
  'open-statements',
  'react-statement',
  'open-differ',
  'point-reasons',
  'open-room',
  'room-messages',
  'room-outcome',
  'open-statement-rule',
  'open-priorities',
  'choose-priorities',
  'point-capacity',
  'open-volunteering',
  'open-decisions',
  'open-refused',
  'open-decision-one',
  'highlight-tests',
  'open-proposal',
  'open-check',
  'open-register',
  'point-in-progress',
  'open-me',
  'open-listening',
  'point-languages',
  'point-no-host',
  'open-ai-and-care',
  'open-feedback',
  'feedback-answer',
  'open-your-feedback',
] as const;

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
