// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// #/notebook — "what unite has heard from you" (design/v2 02 §8): every word,
// every inference, editable and deletable, in your own pod. Lands in phase V2;
// this V0 shell is the honest phase-labelled preview.

import type { AggregateState } from "../../ui/hooks.js";
import type { DeliberationConfig } from "../../ui/state.js";
import { Preview } from "./Preview.js";

export function Notebook(_props: {
  aggregate: AggregateState;
  config: DeliberationConfig;
}): React.JSX.Element {
  return (
    <Preview title="Your notebook" phase="V2">
      <p className="muted small">
        Everything unite has heard from you, in plain language — your words, what the notetaker took
        from them, your reactions, and where you sit on the map. Each item editable or deletable;
        deletion actually propagates, because everything recomputes from your pod.
      </p>
    </Preview>
  );
}
