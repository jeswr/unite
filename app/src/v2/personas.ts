// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// THE MAPLE-STREET PERSONA SEATS (design/v2 06 §2): the staged neighbourhood's
// nine seats — eight VISIBLY FICTIONAL personas spanning the two opinion
// clusters the engine will find, plus the visitor's own seat ("you" — the
// newcomer who hasn't said anything yet). Every persona is labeled demo voice
// (an undisclosed fake human anywhere would fail the reveal test); the
// visitor's seat is the ONLY one that speaks in this demo.

import { DEMO_YOU_KEY, demoWebId } from "../demo/fixtures.js";

/** One persona seat, as the arc's seat-picker renders it. */
export interface PersonaSeat {
  /** The demo person key (demo/fixtures DEMO_PEOPLE). */
  readonly key: string;
  readonly name: string;
  /** One warm line of who they are on Maple Street. */
  readonly intro: string;
  /** True for the visitor's seat — the one that actually speaks. */
  readonly you: boolean;
}

export const PERSONA_SEATS: readonly PersonaSeat[] = [
  {
    key: "amara",
    name: "Amara",
    intro: "wants the centre car-free, cargo bikes and all",
    you: false,
  },
  { key: "ben", name: "Ben", intro: "wants free places to simply be with people", you: false },
  {
    key: "chidi",
    name: "Chidi",
    intro: "lives on the rat-run; done with pass-through traffic",
    you: false,
  },
  {
    key: "dana",
    name: "Dana",
    intro: "carries a week of shopping and a parent's wheelchair",
    you: false,
  },
  { key: "efe", name: "Efe", intro: "judges a street by its most vulnerable user", you: false },
  {
    key: "farah",
    name: "Farah",
    intro: "drives her kids 900 metres to school, hates that she does",
    you: false,
  },
  {
    key: "gus",
    name: "Gus",
    intro: "keeps the shop; wants the street alive after eight",
    you: false,
  },
  {
    key: "hana",
    name: "Hana",
    intro: "wants the people who walk it to have a real say",
    you: false,
  },
  {
    key: DEMO_YOU_KEY,
    name: "You",
    intro: "new to the street, hasn't said anything yet — this seat is yours",
    you: true,
  },
];

/** The visitor's seat WebID (the demo session identity). */
export const YOU_WEBID: string = demoWebId(DEMO_YOU_KEY);
