// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// #/story/<id> — the FATE-TRAIL thread (design/v2 05 §4): one graduated
// idea's life-story in plain words. The anti-graveyard surface:
//
//   • the commitment banner names the listener BEFORE the conversation, so
//     talk is never mistaken for a promise (the CCC "sans filtre" lesson);
//   • every state renders in the plain-word ladder; a resting state carries
//     its stated reason structurally (story-data.ts — P3, no silent dead end);
//   • the honest "not yet" from power is told plainly and warmly;
//   • return loops are mechanical (~30/90/365 days), shown as a scheduled
//     check-in, never a virtue;
//   • the expert moment carries the two-tier honest chip (05 §2);
//   • the demo story is persona-side staged content and SAYS SO (06 §2).

import { formatDate } from "../../ui/format.js";
import { DEMO_NOW, DEMO_STORIES, demoStoryFor } from "../demo-stories.js";
import { MARIA } from "../expert.js";
import {
  currentState,
  nextReturnLoop,
  STORY_STATE_WORDS,
  type StoryEvent,
  type Story as StoryRecord,
} from "../story-data.js";
import { ExpertChip } from "./ExpertChip.js";

function EventRow({ event }: { event: StoryEvent }): React.JSX.Element {
  return (
    <li className="v2-story-event">
      <span className="v2-story-state">{STORY_STATE_WORDS[event.state]}</span>{" "}
      <span className="muted small">· {formatDate(event.date, DEMO_NOW)}</span>
      <p className="v2-story-text">
        {event.text}{" "}
        {event.link !== undefined && (
          <a href={event.link} className="small">
            see it →
          </a>
        )}
      </p>
      {/* An honest park always states its reason (P3 — structural in the type). */}
      {event.state === "resting" && (
        <p className="muted small">Resting, with its reason said out loud: {event.reason}</p>
      )}
      {/* The expert moment: Maria's line carries her tier-honest chip. */}
      {event.who === MARIA.name && <ExpertChip expert={MARIA} />}
    </li>
  );
}

function StoryThread({ story }: { story: StoryRecord }): React.JSX.Element {
  const state = currentState(story);
  const loop = nextReturnLoop(story, DEMO_NOW);
  return (
    <section className="view">
      <h2>{story.title}</h2>
      <p className="muted small">
        {story.origin} Right now it is <strong>{STORY_STATE_WORDS[state]}</strong>.
        {story.demoVoice && (
          <span className="badge demo" style={{ marginLeft: "0.5rem" }}>
            demo voice — this trail is staged with made-up people
          </span>
        )}
      </p>

      {/* Commitment before conversation (05 §4): the named listener, up front. */}
      {story.commitment !== undefined && (
        <div className="v2-summary">
          <p className="muted small" style={{ margin: 0 }}>
            <strong>{story.commitment.listener} is listening</strong> — {story.commitment.promise}
          </p>
        </div>
      )}

      <ol className="v2-story-trail" aria-label="the story so far">
        {story.events.map((e) => (
          <EventRow key={`${e.date}-${e.state}`} event={e} />
        ))}
      </ol>

      {/* The mechanical return loop — scheduled, never remembered (05 §4). */}
      {loop !== null && (
        <p className="muted small">
          Next check-in: around {formatDate(loop.date.toISOString(), DEMO_NOW)} — the system will
          ask "shall we look in on this?" and re-invite the original circle. That happens on a
          schedule, not on goodwill.
        </p>
      )}

      {story.champion !== undefined && (
        <p className="muted small">
          Inside champion: {story.champion.name}, {story.champion.role}. If they move on, a handover
          is triggered — a theme never dies of a departure in silence.
        </p>
      )}

      <p className="v2-seam-text">
        Why a story page at all? A platform that is all sensemaking and no consequences teaches
        people that talking here changes nothing — so every graduated idea keeps a life-story,
        including the honest "not yet". <a href="#/how">the long version →</a>
      </p>
    </section>
  );
}

export function Story({ id }: { id?: string | undefined }): React.JSX.Element {
  const story = id !== undefined ? demoStoryFor(id) : null;
  if (story !== null) return <StoryThread story={story} />;
  return (
    <section className="view">
      <div className="card">
        <h2>What came of it</h2>
        <p className="muted">
          {id !== undefined
            ? "That story isn't here. "
            : "Each story follows one idea from the circle that raised it through whatever actually happened to it. "}
          The demo has {DEMO_STORIES.length === 1 ? "one story" : `${DEMO_STORIES.length} stories`}{" "}
          so far:
        </p>
        <ul>
          {DEMO_STORIES.map((s) => (
            <li key={s.slug}>
              <a href={`#/story/${encodeURIComponent(s.slug)}`}>{s.title}</a>{" "}
              <span className="muted small">— {STORY_STATE_WORDS[currentState(s)]}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
