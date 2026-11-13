import type { SeedCtx } from './builders.js';

/**
 * Hook for another part of the build. The volunteering tool: 36 participants and the five decisions with their answers, proposals, delivery items and the check.
 * Runs after seedAssemblies. Must be idempotent: use fixed ids (stableId) so a second run
 * overwrites rather than duplicates.
 */
export async function seedVolunteering(ctx: SeedCtx): Promise<void> {
  void ctx;
}
