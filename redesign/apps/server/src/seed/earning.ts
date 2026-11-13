import type { SeedCtx } from './builders.js';

/**
 * Hook for another part of the build. Earning and learning: 48 invited participants with completed conversations, themes, statements S1 to S8 with reactions giving two opinion groups, the room on S5 with six members and two evidence cards, priority choices for 31 people, one answered objection on S4, one upheld report.
 * Runs after seedAssemblies. Must be idempotent: use fixed ids (stableId) so a second run
 * overwrites rather than duplicates.
 */
export async function seedEarning(ctx: SeedCtx): Promise<void> {
  void ctx;
}
