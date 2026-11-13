import { fixedClock } from '@unite/shared';
import type { Deps } from '../deps.js';
import { seedAiAndCare } from './aiAndCare.js';
import { SEED_NOW, seedAssemblies } from './assemblies.js';
import type { SeedCtx } from './builders.js';
import { seedEarning } from './earning.js';
import { seedFeedbackAssembly } from './feedbackAssembly.js';
import { seedMediations } from './mediations.js';
import { seedOpen } from './open.js';
import { seedVolunteering } from './volunteering.js';

/**
 * Writes the example data of section 9. Every record has a fixed id and a timestamp from a clock
 * fixed at the reference date, so seeding is reproducible and running it twice changes nothing.
 */
export async function seed(deps: Pick<Deps, 'store'>): Promise<void> {
  const ctx: SeedCtx = { store: deps.store, clock: fixedClock(SEED_NOW) };
  await deps.store.transaction(async () => {
    await seedAssemblies(ctx);
    await seedOpen(ctx);
    await seedEarning(ctx);
    await seedMediations(ctx);
    await seedVolunteering(ctx);
    await seedAiAndCare(ctx);
    await seedFeedbackAssembly(ctx);
  });
}

/** Seeds only when the store has no assemblies (demo mode at start-up). Returns whether it seeded. */
export async function seedIfEmpty(deps: Pick<Deps, 'store'>): Promise<boolean> {
  if ((await deps.store.count('assemblies')) > 0) return false;
  await seed(deps);
  return true;
}
