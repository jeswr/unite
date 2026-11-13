import type { SeedCtx } from './builders.js';

/**
 * Hook for another part of the build. Making Unite better: no people and no points. Anything else beyond its assembly record and draft pledge.
 * Runs after seedAssemblies. Must be idempotent: use fixed ids (stableId) so a second run
 * overwrites rather than duplicates.
 */
export async function seedFeedbackAssembly(ctx: SeedCtx): Promise<void> {
  void ctx;
}
