import type { Report, Theme } from '@unite/shared';

/**
 * Response shapes of the picture and listening endpoints. The web keeps an identical copy in
 * apps/web/src/pages/picture/types.ts until these move to packages/shared.
 */

/** A point someone agreed to show. `name` only when they chose to be named; never a person id. */
export interface Quote {
  id: string;
  text: string;
  /** English rendering when the original is not English. */
  textEn?: string;
  name?: string;
  /** One of my own points. */
  mine?: boolean;
}

/** "This is not what was said", as shown beside the thing reported. Never says who reported it. */
export interface ReportView {
  id: string;
  kind: Report['kind'];
  text: string;
  status: Report['status'];
  outcomeNote?: string;
  createdAt: string;
  resolvedAt?: string;
  mine: boolean;
}

export interface SentenceView {
  text: string;
  /** People behind the sentence, counted by code (rule 4). */
  people: number;
  /** The sentence's sources that may be quoted, in time order. */
  quotes: Quote[];
}

export interface ThemeView {
  id: string;
  kind: Theme['kind'];
  name: string;
  people: number;
  sentences: SentenceView[];
  /** Up to three, in time order, from points shown anonymously or with a name. */
  quotes: Quote[];
  reports: ReportView[];
  /** My own points in this theme ("You said this"). */
  mine: { id: string; text: string }[];
  /** Assemblies opened to answer this theme (open listening only). */
  hostedBy?: { slug: string; title: string }[];
}

export interface ThemeSection {
  kind: Theme['kind'];
  title: string;
  themes: ThemeView[];
}

export interface MissingGroup {
  key: string;
  label: string;
  heard: number;
  target: number;
  /** Below half the target. */
  underHeard: boolean;
}

/** GET /api/assemblies/:slug/picture */
export interface PictureResponse {
  totals: { people: number; points: number };
  sections: ThemeSection[];
  /** Trade-offs and doubts: not themed, shown as quotes only. */
  hardChoices: { people: number; quotes: Quote[] };
  missing: MissingGroup[];
  confirmed: { at: string; by: string } | null;
  /** Approved points that are not in a theme yet. */
  unthemed: number;
  /** An update is running; the page refreshes when it ends. */
  updating: boolean;
  canUpdate: boolean;
  canConfirm: boolean;
}

/** GET /api/themes/:id/points */
export interface ThemePointsResponse {
  theme: { id: string; kind: Theme['kind']; name: string };
  people: number;
  quotes: Quote[];
  mine: { id: string; text: string }[];
}

/** GET /api/listening */
export interface ListeningResponse {
  assembly: { slug: string; title: string; question: string; isExample: boolean } | null;
  /** Theme sentences, quotes and good ordinary days are included only when this is true (rule 1). */
  heard: boolean;
  totals: { people: number; points: number };
  sections: ThemeSection[];
  noHost: { id: string; kind: Theme['kind']; name: string; people: number }[];
  days: { id: string; name: string; people: number; quotes: Quote[] }[];
}
