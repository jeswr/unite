// Shared shapes for the demonstration's invented example data.

export type LayerId = 'kisumu' | 'krakow' | 'medellin' | 'dhaka' | 'glasgow' | 'cusco';
export type Door = 'open' | 'drawn';
export type Route = 'web' | 'voice' | 'phone' | 'listener';
export type AgeBand = '18–29' | '30–44' | '45–64' | '65+';
export type Tier = 'validated' | 'assisted' | 'human';
export type WorkView = 'steady' | 'limit' | 'own' | 'ayni' | 'unsaid';
export type CareView = 'home' | 'places' | 'useful' | 'unsaid';

export type ThemeId =
  | 'time'
  | 'move'
  | 'respect'
  | 'safe'
  | 'water'
  | 'ownlang'
  | 'lonely'
  | 'damp'
  | 'lanes'
  | 'youth'
  | 'fish'
  | 'fairprice'
  | 'cheapfood'
  | 'newhomes'
  | 'green';

export interface Language {
  code: string; // BCP 47, used for lang="" on original words
  name: string; // English name
  endonym: string;
  tier: Tier;
}

export interface Layer {
  id: LayerId;
  kind: 'place' | 'circle';
  name: string;
  /** How the layer is named in running text. */
  shortName: string;
  country?: string;
  language: Language;
  /** Conversations per door in the seed data. */
  size: Record<Door, number>;
  /** Four invented areas inside a place (or groups inside a circle), for the second count at place level. */
  areas: string[];
  routeNote: string;
  /** Who is missing, written by hand for each layer (the rest of "Not yet heard" is computed). */
  missing: string[];
  retention: { survive: number; of: number; threshold: number; note: string };
}

export interface Conversation {
  id: string;
  layer: LayerId;
  door: Door;
  route: Route;
  age: AgeBand;
  area: number;
  themes: ThemeId[];
  work: WorkView;
  care: CareView;
}

/** Original words with a labelled translation. */
export interface Words {
  lang: string; // BCP 47 of the original
  original: string;
  /** English translation; absent when the original is English. */
  translation?: string;
  /** Value-laden words kept in the original, with a gloss. */
  glosses?: { word: string; gloss: string }[];
}

export interface Quote extends Words {
  layer: LayerId;
  /** e.g. "A stall-holder, 30–44, by phone". Never a name. */
  who: string;
}
