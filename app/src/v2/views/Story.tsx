// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// #/story/<id> — the fate-trail thread (design/v2 05 §4): a graduated idea's
// life-story. Lands in phase V4 (lib/story.ts + the state ladder); until then
// this is the honest phase-labelled preview, never a fake.

import { Preview } from "./Preview.js";

export function Story({ id }: { id?: string | undefined }): React.JSX.Element {
  return (
    <Preview title="What came of it" phase="V4">
      <p className="muted small">
        {id !== undefined ? `The story "${id}" ` : "Each story "}
        will be a plain-word thread following one idea from the circle that raised it through
        whatever actually happened to it — including honest resting states with a reason, never a
        silent dead end.
      </p>
    </Preview>
  );
}
