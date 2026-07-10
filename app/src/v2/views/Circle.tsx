// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// #/circle/<id> — the circle (design/v2 02 §2–4): the entire deliberation
// surface, as a chat. Lands in phase V1 (the mirror pipeline + the notetaker
// script); this V0 shell is the honest phase-labelled preview.

import type { AggregateState } from "../../ui/hooks.js";
import type { DeliberationConfig } from "../../ui/state.js";
import { demoCircleFor } from "../demo-circle.js";
import { Preview } from "./Preview.js";

export function Circle({
  circleSlug,
}: {
  circleSlug: string;
  aggregate: AggregateState;
  config: DeliberationConfig;
}): React.JSX.Element {
  const circle = demoCircleFor(circleSlug);
  return (
    <Preview title={circle ? `The ${circle.name} circle` : "A circle"} phase="V1">
      <p className="muted small">
        A circle is a few people and a plainly-introduced notetaker, talking about what they want
        life here to look like. It arrives with the mirror pipeline — speak, be accurately mirrored,
        adopt or fix or scrap what the notetaker heard.
      </p>
    </Preview>
  );
}
