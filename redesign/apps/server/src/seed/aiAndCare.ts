import type { SeedCtx } from './builders.js';

/**
 * Hook for another part of the build. AI and care: no conversations yet. Anything else the example needs beyond its assembly record.
 * Runs after seedAssemblies. Must be idempotent: use fixed ids (stableId) so a second run
 * overwrites rather than duplicates.
 */
export async function seedAiAndCare(ctx: SeedCtx): Promise<void> {
  void ctx;
}
