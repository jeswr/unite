import type { SeedCtx } from './builders.js';

/**
 * Hook for another part of the build. The open-listening picture: 60 people across at least 14 countries, 3 to 5 points each, 20 or more in other languages (with textEn), themes of every kind, at least four themes with no hosted assembly.
 * Runs after seedAssemblies. Must be idempotent: use fixed ids (stableId) so a second run
 * overwrites rather than duplicates.
 */
export async function seedOpen(ctx: SeedCtx): Promise<void> {
  void ctx;
}
