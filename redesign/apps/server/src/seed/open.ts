import { ASSEMBLY_IDS } from './assemblies.js';
import type { SeedCtx } from './builders.js';
import { OPEN_CARE_THEME_KEY, OPEN_PEOPLE, OPEN_THEMES } from './content/openPeople.js';
import { idsFor, writePeople, writeThemes } from './content/write.js';

export const OPEN_SCOPE = 'open';
const ids = idsFor(OPEN_SCOPE);

/** Fixed ids of the open-listening records other code and tests refer to. */
export const OPEN_IDS = {
  theme: (key: string) => ids.theme(key),
  person: (key: string) => ids.person(key),
  point: (ref: string) => ids.point(ref),
  /** The theme about caring for an ageing parent while working, which the AI-and-care assembly answers. */
  careTheme: ids.theme(OPEN_CARE_THEME_KEY),
};

/**
 * Open listening: 60 people in 14 countries (August to November 2026), 3 to 5 approved points
 * each, 29 of them in a language other than English, and the themes of the picture.
 */
export async function seedOpen(ctx: SeedCtx): Promise<void> {
  await writePeople(ctx, { scope: OPEN_SCOPE, assemblyId: ASSEMBLY_IDS.open, people: OPEN_PEOPLE, start: '2026-08-03T00:00:00.000Z', end: '2026-11-11T23:00:00.000Z', invited: false });
  await writeThemes(ctx, { scope: OPEN_SCOPE, assemblyId: ASSEMBLY_IDS.open, people: OPEN_PEOPLE, themes: OPEN_THEMES, at: '2026-11-12T08:00:00.000Z' });
}
