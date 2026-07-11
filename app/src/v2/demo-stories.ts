// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The seeded Maple-crossing fate-trail (design/v2 05 §4's worked example;
// 06 §3 beat 6 "see consequence"). PERSONA-SIDE STAGED CONTENT — labeled as
// such (`demoVoice: true`) per the 06 §2 honesty rule: the only scripted
// content in the demo is persona-side; the machinery around it (state
// ladder, return loops, letter deltas) is the real, tested code. The story
// deliberately includes the HONEST "not yet" from the council — visible
// cherry-picking converts betrayal into informed strategy (05 §4); silence
// is what kills trust.
//
// Dates sit just before the demo's simulated "now" so the letter's monthly
// rhythm has a delta to carry and a return loop to schedule.

import type { Story } from "./story-data.js";

/** The demo's simulated clock (the letter's month; 07 §3 V5). */
export const DEMO_NOW = new Date("2026-06-28T12:00:00Z");

/** The simulated NEXT month (the letter's rhythm peek — one month on). */
export const DEMO_NEXT_MONTH = new Date("2026-07-28T12:00:00Z");

export const MAPLE_CROSSING: Story = {
  slug: "maple-crossing",
  title: "The Maple crossing",
  origin: "Started as a chat in the Maple mornings circle.",
  demoVoice: true,
  commitment: {
    listener: "The council's roads team",
    promise: "they'll answer whatever comes out of this by June — Cllr Osei is carrying it.",
  },
  champion: { name: "Cllr Osei", role: "carrying it inside the council" },
  events: [
    {
      state: "dreaming",
      date: "2026-03-04",
      text: "A morning chat about sprinting across Maple before the lights change.",
      link: "#/circle/maple-mornings",
    },
    {
      state: "taking-shape",
      date: "2026-03-22",
      text: "14 people shaped it into one ask: a safe crossing at the shop corner.",
    },
    {
      state: "taking-shape",
      date: "2026-04-05",
      text: "Maria weighed in — two options costed: paint-and-signs now, a raised table later. The cheap one floods in winter; she said so.",
      who: "Maria",
    },
    {
      state: "asked",
      date: "2026-04-18",
      text: "Asked the council, in the group's own words. Cllr Osei carrying it.",
      who: "Cllr Osei",
    },
    {
      state: "answered",
      date: "2026-05-20",
      text: "Answered: yes to paint and signs this year; not yet to the raised table — budget review in autumn. Their words, linked.",
      link: "#/story/maple-crossing",
    },
    {
      state: "alive",
      date: "2026-06-14",
      text: "The paint happened. Photo in the circle; checking back when the budget review lands.",
    },
  ],
};

/** Every seeded story, in display order. */
export const DEMO_STORIES: readonly Story[] = [MAPLE_CROSSING];

/** Fail-closed lookup: a route slug resolves to a KNOWN story or null. */
export function demoStoryFor(slug: string): Story | null {
  return DEMO_STORIES.find((s) => s.slug === slug) ?? null;
}
