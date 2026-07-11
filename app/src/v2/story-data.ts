// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// FATE-TRAILS — the data shape + pure helpers (design/v2 05 §4, 07 §3 V4):
// a graduated idea's life-story, told in PLAIN-WORD STATES over a trail of
// dated events. The anti-graveyard machinery, structurally honest:
//
//   • the state ladder is TOTAL and its words are pinned here — dreaming /
//     taking shape / asked / answered / being built / alive / resting;
//   • RESTING REQUIRES A REASON *by type* — a `resting` event without its
//     stated reason is unrepresentable, so a silent dead end cannot be
//     written (P3: the graveyard is the trust-killer);
//   • return loops are MECHANICAL, not virtuous: `returnLoopDue` computes
//     the ~30/90/365-day check-ins from the trail's last event and a
//     SIMULATED clock (the demo has no real one — 07 §3 V5's monthly-rhythm
//     simulation), never from goodwill;
//   • the letter's "what changed because people spoke" lines derive from the
//     trail (`letterChangedLines`) — every sentence traceable to an event.
//
// In the build plan this read eventually rides `wf:Tracker`/`wf:Task` over
// dedicated `stories/` pod containers (05 §4; the channel.ts fold pattern).
// The DEMO stages the consequence loop on seeded, labeled data — the same
// honest posture the pitch page states out loud ("the expert and consequence
// loops run end-to-end on seeded, labeled data") — so the demo story is a
// typed seed record (v2/demo-stories.ts), rendered by the same view a pod
// read would feed. The live pod read is deferred work, tracked, not faked.

/** The plain-word state ladder (05 §4) — stable ids, pinned words. */
export type StoryStateId =
  | "dreaming"
  | "taking-shape"
  | "asked"
  | "answered"
  | "being-built"
  | "alive"
  | "resting";

/** The pinned plain words for each state (the ladder the view renders). */
export const STORY_STATE_WORDS: Readonly<Record<StoryStateId, string>> = {
  dreaming: "dreaming",
  "taking-shape": "taking shape",
  asked: "asked",
  answered: "answered",
  "being-built": "being built",
  alive: "alive",
  resting: "resting",
};

/** One dated event on the trail. `resting` structurally carries its reason. */
export type StoryEvent =
  | {
      readonly state: Exclude<StoryStateId, "resting">;
      /** ISO date the event happened. */
      readonly date: string;
      /** The plain-language line ("14 people shaped it", "the paint happened"). */
      readonly text: string;
      /** An in-app link target for "their words, linked" (a hash route). */
      readonly link?: string;
      /** Who spoke/acted, when the line quotes or credits someone. */
      readonly who?: string;
    }
  | {
      readonly state: "resting";
      readonly date: string;
      readonly text: string;
      /** REQUIRED: an honest park always states its reason (P3). */
      readonly reason: string;
      readonly link?: string;
      readonly who?: string;
    };

/** A commitment banner: the named listener, said before the conversation. */
export interface StoryCommitment {
  /** Who is listening ("The parks team", "Cllr Osei for the council"). */
  readonly listener: string;
  /** What they committed to, plainly ("they'll answer … by June"). */
  readonly promise: string;
}

/** The named inside champion (05 §4 — visible role, handover on departure). */
export interface StoryChampion {
  readonly name: string;
  readonly role: string;
}

/** One fate-trail story. */
export interface Story {
  /** The route slug (#/story/<slug>) — an opaque selector, never fetched. */
  readonly slug: string;
  readonly title: string;
  /** Where it started ("started as a chat in the Mornings circle"). */
  readonly origin: string;
  /** The trail, oldest first. Never empty. */
  readonly events: readonly StoryEvent[];
  readonly commitment?: StoryCommitment;
  readonly champion?: StoryChampion;
  /** True when this story is demo staging (persona-side content, labeled). */
  readonly demoVoice: boolean;
}

/** The story's CURRENT state = its latest event's state (the trail is ordered). */
export function currentState(story: Story): StoryStateId {
  const last = story.events[story.events.length - 1];
  // The type says events is never empty; fail honest if a seed violates it.
  if (last === undefined) throw new Error(`story ${story.slug}: no events`);
  return last.state;
}

/** The mechanical return-loop schedule, in days after the last event (05 §4). */
export const RETURN_LOOP_DAYS: readonly number[] = [30, 90, 365];

const DAY_MS = 86_400_000;

/**
 * The next scheduled "shall we look in on this?" — computed, never remembered:
 * the first of the ~30/90/365-day checkpoints after the LAST event that is
 * still ahead of `now` (the simulated clock), or null when all have passed.
 * Pure and deterministic.
 */
export function nextReturnLoop(story: Story, now: Date): { date: Date; days: number } | null {
  const last = story.events[story.events.length - 1];
  if (last === undefined) return null;
  const lastMs = Date.parse(last.date);
  if (Number.isNaN(lastMs)) return null;
  for (const days of RETURN_LOOP_DAYS) {
    const due = lastMs + days * DAY_MS;
    if (due > now.getTime()) return { date: new Date(due), days };
  }
  return null;
}

/** A return loop is DUE when a checkpoint passed since the last event (≤ now). */
export function returnLoopDue(story: Story, now: Date): boolean {
  const last = story.events[story.events.length - 1];
  if (last === undefined) return false;
  const lastMs = Date.parse(last.date);
  if (Number.isNaN(lastMs)) return false;
  return RETURN_LOOP_DAYS.some((days) => lastMs + days * DAY_MS <= now.getTime());
}

/** One letter "what changed" line, linked to its story. */
export interface ChangedLine {
  readonly text: string;
  /** The story route the line drills into. */
  readonly href: string;
}

/**
 * The letter's part-(c) lines for a set of stories at a simulated `now`
 * (03 §4: the digest composes engine outputs + trail deltas; this is the
 * trail-delta half). One line per story that MOVED in the letter's month —
 * an event dated within ~31 days before `now` — plus a return-loop line when
 * a checkpoint fell due (the Ostbelgien follow-through, mechanical). Pure.
 */
export function letterChangedLines(stories: readonly Story[], now: Date): ChangedLine[] {
  const out: ChangedLine[] = [];
  const monthAgo = now.getTime() - 31 * DAY_MS;
  for (const story of stories) {
    const href = `#/story/${encodeURIComponent(story.slug)}`;
    const recent = story.events.filter((e) => {
      const t = Date.parse(e.date);
      return !Number.isNaN(t) && t > monthAgo && t <= now.getTime();
    });
    const last = recent[recent.length - 1];
    if (last !== undefined) {
      out.push({ text: `${story.title} — ${STORY_STATE_WORDS[last.state]}: ${last.text}`, href });
    }
    if (returnLoopDue(story, now) && last === undefined) {
      out.push({
        text: `${story.title} — shall we look in on this? A check-in fell due; the original circle is re-invited.`,
        href,
      });
    }
  }
  return out;
}
