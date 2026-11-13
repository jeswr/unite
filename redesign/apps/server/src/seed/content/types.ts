import type { PointType } from '@unite/shared';

/** How a point is shown: `a` anonymous, `c` counted only, `n` with the person's first name. */
export type Vis = 'a' | 'c' | 'n';

/**
 * One approved point, as a tuple so the content files read like a list of things people said:
 * [type, visibility, theme key or null, text in the person's language, English rendering when the
 * text is not English].
 */
export type PointSpec = [type: PointType, vis: Vis, theme: string | null, text: string, textEn?: string];

/** A turn of a seeded transcript: [stage, who, text]. */
export type TurnSpec = [stage: number, role: 'interviewer' | 'person', text: string];

/** A point drawn from a transcript, citing the turns (by index in `turns`) it came from. */
export interface TranscriptPoint {
  type: PointType;
  vis: Vis;
  theme: string | null;
  text: string;
  from: number[];
}

export interface Transcript {
  turns: TurnSpec[];
  points: TranscriptPoint[];
  exit?: { soundsLikeMe: 1 | 2 | 3 | 4; pushed: 'no' | 'a_little' | 'yes'; note?: string };
}

/** An invented example person and what they approved. */
export interface PersonSpec {
  /** Readable key, unique within the assembly; ids are derived from it. */
  key: string;
  /** First name only. */
  name: string;
  /** BCP 47; for open listening the region subtag is the person's country. */
  locale?: string;
  /** Conversation language. */
  language?: string;
  about: Record<string, string>;
  /** Ignored when `transcript` is given: the points then come from the transcript. */
  points: PointSpec[];
  /** One of the six people with a full transcript. */
  transcript?: Transcript;
}

export interface ThemeSpec {
  key: string;
  kind: 'matters' | 'barrier' | 'idea' | 'day';
  /** Taken word for word from one of the theme's points (its text or its English rendering). */
  name: string;
  /** Each sentence cites points by `personKey/n` (n counts from 1 in the person's list). */
  sentences: { text: string; from: string[] }[];
}
