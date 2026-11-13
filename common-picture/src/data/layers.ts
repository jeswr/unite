import type { Language, Layer, LayerId, Tier } from './types';

// Language tiers are illustrative. No language here has been assessed.
export const LANGUAGES: Record<string, Language> = {
  sw: { code: 'sw', name: 'Kiswahili', endonym: 'Kiswahili', tier: 'validated' },
  pl: { code: 'pl', name: 'Polish', endonym: 'Polski', tier: 'validated' },
  es: { code: 'es', name: 'Spanish', endonym: 'Español', tier: 'validated' },
  bn: { code: 'bn', name: 'Bengali', endonym: 'বাংলা', tier: 'assisted' },
  en: { code: 'en', name: 'English', endonym: 'English', tier: 'validated' },
  qu: { code: 'qu', name: 'Quechua', endonym: 'Runasimi', tier: 'human' },
};

export const TIER_LABEL: Record<Tier, string> = {
  validated: 'Validated',
  assisted: 'Assisted',
  human: 'Human listener',
};

export const TIER_MEANING: Record<Tier, string> = {
  validated: 'The AI interviews alone, once native speakers have reviewed sample transcripts.',
  assisted: 'The AI interviews with a human listener present, or a person reviews every summary.',
  human: 'A listener holds the conversation and records points in the original language.',
};

export const LAYERS: Layer[] = [
  {
    id: 'kisumu',
    kind: 'place',
    name: 'Kisumu, Kenya',
    shortName: 'Kisumu',
    country: 'Kenya',
    language: LANGUAGES.sw,
    size: { open: 18, drawn: 12 },
    areas: ['Lakeside area', 'Market area', 'Estates', 'Outskirts'],
    routeNote: 'Many take part by an ordinary phone call or voice notes.',
    missing: [
      'People who speak only Dholuo, until a Dholuo listener joins',
      'Fishers who are on the lake at the hours the callbacks run',
    ],
    retention: { survive: 4, of: 4, threshold: 3, note: 'Distinct themes raised by fewer than a fifth of people here.' },
  },
  {
    id: 'krakow',
    kind: 'place',
    name: 'Kraków, Poland',
    shortName: 'Kraków',
    country: 'Poland',
    language: LANGUAGES.pl,
    size: { open: 17, drawn: 13 },
    areas: ['Old blocks', 'New estates', 'Centre', 'Edge of the city'],
    routeNote: 'Most take part on the web; a few by phone.',
    missing: ['Ukrainian speakers, until conversations in Ukrainian are offered', 'Night-shift workers'],
    retention: { survive: 3, of: 3, threshold: 2, note: 'Distinct themes raised by fewer than a fifth of people here.' },
  },
  {
    id: 'medellin',
    kind: 'place',
    name: 'Medellín, Colombia',
    shortName: 'Medellín',
    country: 'Colombia',
    language: LANGUAGES.es,
    size: { open: 18, drawn: 12 },
    areas: ['Hillside neighbourhoods', 'Centre', 'River valley', 'Rural edge'],
    routeNote: 'A mix of web, voice notes and phone calls.',
    missing: ['Families who arrived in the last year', 'Young men aged 18 to 24 on the open door'],
    retention: { survive: 3, of: 4, threshold: 3, note: 'Distinct themes raised by fewer than a fifth of people here.' },
  },
  {
    id: 'dhaka',
    kind: 'place',
    name: 'Dhaka, Bangladesh',
    shortName: 'Dhaka',
    country: 'Bangladesh',
    language: LANGUAGES.bn,
    size: { open: 16, drawn: 14 },
    areas: ['Old town', 'Garment district', 'New suburbs', 'Riverside'],
    routeNote: 'Voice first. Bengali is in the assisted tier: a person reviews every summary.',
    missing: ['Women working night shifts in garment factories', 'People over 65 on the open door'],
    retention: { survive: 3, of: 3, threshold: 2, note: 'Distinct themes raised by fewer than a fifth of people here.' },
  },
  {
    id: 'glasgow',
    kind: 'place',
    name: 'Glasgow, Scotland',
    shortName: 'Glasgow',
    country: 'Scotland',
    language: LANGUAGES.en,
    size: { open: 19, drawn: 11 },
    areas: ['East End', 'Southside', 'West End', 'Peripheral estates'],
    routeNote: 'Mostly on the web; the drawn sample adds phone calls.',
    missing: ['Arabic and Urdu speakers, until those languages are offered', 'Young carers'],
    retention: { survive: 4, of: 4, threshold: 3, note: 'Distinct themes raised by fewer than a fifth of people here.' },
  },
  {
    id: 'cusco',
    kind: 'circle',
    name: 'An invented Quechua-speaking community near Cusco',
    shortName: 'Quechua-speaking circle',
    language: LANGUAGES.qu,
    size: { open: 12, drawn: 0 },
    areas: ['Families on the upper slopes', 'Families by the river', 'Elders', 'Young people'],
    routeNote: 'Every conversation held by a human listener. The community holds its own data.',
    missing: ['Young people who have moved to the city for work', 'A drawn sample: circles are not sampled in this demonstration'],
    retention: { survive: 2, of: 2, threshold: 2, note: 'Distinct themes raised by fewer than a fifth of people in this circle.' },
  },
];

export const LAYER: Record<LayerId, Layer> = Object.fromEntries(LAYERS.map((l) => [l.id, l])) as Record<
  LayerId,
  Layer
>;

export const PLACES = LAYERS.filter((l) => l.kind === 'place');
