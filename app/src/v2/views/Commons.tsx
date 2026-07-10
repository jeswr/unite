// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// #/commons — the calm ambient home (design/v2 02 §6): the garden, the
// letter, your circles, one gentle prompt. Lands in phase V2 (the sensemaking
// surfaces); this V0 shell is the honest phase-labelled preview.

import type { AggregateState } from "../../ui/hooks.js";
import type { DeliberationConfig } from "../../ui/state.js";
import type { V2Route } from "../route.js";
import { Preview } from "./Preview.js";

export function Commons(_props: {
  aggregate: AggregateState;
  config: DeliberationConfig;
  onNavigate: (r: V2Route) => void;
}): React.JSX.Element {
  return (
    <Preview title="The commons" phase="V2">
      <p className="muted small">
        A slow, non-numeric picture of what this community is figuring out together — the garden,
        the monthly letter, and your circles. No feeds, no tallies, no trending.
      </p>
    </Preview>
  );
}
