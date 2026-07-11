// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The two-tier expert chip (design/v2 05 §2): renders exactly the strength of
// what was actually verified, and its seam NAMES the issuer. Steward-invited
// carries no checkmark — unite refuses to fake authority with an unbacked ✓.

import { type ExpertRecord, expertChipLabel, expertChipSeam } from "../expert.js";

export function ExpertChip({ expert }: { expert: ExpertRecord }): React.JSX.Element {
  return (
    <span className="v2-expert-chip">
      <span className="v2-expert-chip-label">{expertChipLabel(expert)}</span>
      <span className="v2-seam-text" style={{ display: "block" }}>
        Who stands behind that? {expertChipSeam(expert)} <a href="#/how">the long version →</a>
      </span>
    </span>
  );
}
