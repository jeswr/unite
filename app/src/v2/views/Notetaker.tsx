// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The notetaker's rendering (design/v2 02 §2, P9's visual half): quiet,
// role-marked, never person-shaped — a dashed square mark, not an avatar
// circle; the role label on every line; no typing-pause theater.

import { NOTETAKER_NAME } from "../script.js";

/** The notetaker's role label (used inline where a bubble is too much). */
export function NotetakerLine(): React.JSX.Element {
  return <p className="v2-msg-who">{NOTETAKER_NAME}</p>;
}

/** One notetaker message bubble. */
export function Notetaker({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="v2-msg notetaker">
      <span className="v2-notetaker-mark" aria-hidden="true">
        u
      </span>
      <div className="v2-msg-body">
        <NotetakerLine />
        <p className="v2-msg-text">{text}</p>
      </div>
    </div>
  );
}
