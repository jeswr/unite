// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// #/how — "How unite listens" (design/v2 03 §6 second layer): the full
// out-of-flow explanation of the machinery, with links to the v1 instrument
// views. The full write-up lands in phase V2; this V0 shell carries the honest
// core promise + the instrument links already (hiding them would fail the
// reveal test).

import { surfaceHref } from "../../scope/surface.js";
import { Preview } from "./Preview.js";

export function How(): React.JSX.Element {
  const loc = typeof window === "undefined" ? null : window.location;
  return (
    <Preview title="How unite listens" phase="V2">
      <p className="muted small">
        unite's notetaker listens for what matters to people and where they agree more than they'd
        guess — with a small, deterministic, open-source engine, disclosed here in full. The
        write-up arrives with phase V2; the instruments themselves are already inspectable:
      </p>
      <p className="muted small">
        <a href={surfaceHref("v1", loc?.search, "#/bridge")}>the opinion map + common ground</a> ·{" "}
        <a href={surfaceHref("v1", loc?.search, "#/deck")}>the resonance deck</a> ·{" "}
        <a href={surfaceHref("v1", loc?.search, "#/room")}>the convergence room</a>
      </p>
    </Preview>
  );
}
