import { describe, expect, it } from 'vitest';
import { ASSEMBLY_IDS, ASSEMBLY_SLUGS } from '../src/seed/assemblies.js';
import { seed, seedIfEmpty } from '../src/seed/index.js';
import { testEnv } from './helpers.js';

describe('seed', () => {
  it('writes the five assemblies of section 9 and is idempotent', async () => {
    const env = await testEnv();
    try {
      expect(await seedIfEmpty(env.deps)).toBe(true);
      expect(await seedIfEmpty(env.deps)).toBe(false);
      await seed(env.deps);
      const all = await env.deps.store.list('assemblies');
      expect(all.map((a) => a.slug).sort()).toEqual(Object.values(ASSEMBLY_SLUGS).sort());
      expect(await env.deps.store.count('invites')).toBe(3);

      const byId = (id: string) => all.find((a) => a.id === id)!;
      expect(byId(ASSEMBLY_IDS.open)).toMatchObject({ isOpenListening: true, kind: 'listening', scale: 'global', stage: 'listening', isExample: true, pledge: null });
      const earning = byId(ASSEMBLY_IDS.earning);
      expect(earning).toMatchObject({ kind: 'codecided', scale: 'local', stage: 'deciding', hostName: 'Riverbend Council and Riverbend College' });
      expect(earning.pledge).toMatchObject({ decisionLevel: 2, groupThreshold: 0.6, minParticipants: 40, capacity: 5, replyBy: '2026-12-18', checkBody: 'panel', reviewAfterDays: 365 });
      expect(earning.affectedGroups.map((g) => g.label)).toEqual(['Shift workers', 'Parents and carers', 'Under 25', 'Over 50', 'Out of work', 'Local employers']);
      expect(earning.affectedGroups.find((g) => g.key === 'under_25')?.target).toBe(10);
      expect(byId(ASSEMBLY_IDS.volunteering)).toMatchObject({ kind: 'technology', scale: 'sector', stage: 'delivering' });
      const care = byId(ASSEMBLY_IDS.aiAndCare);
      expect(care).toMatchObject({ kind: 'advisory', scale: 'global', stage: 'pledged' });
      expect(care.probes).toHaveLength(3);
      expect(care.pledge?.challengeEndsAt).toBe('2026-11-22T09:00:00.000Z');
      expect(byId(ASSEMBLY_IDS.feedback)).toMatchObject({ kind: 'advisory', scale: 'platform', stage: 'proposed', isExample: false });
      expect(byId(ASSEMBLY_IDS.feedback).pledge?.publishedAt).toBeUndefined();
      // Each example was opened before its first conversation; only Unite's own assembly is new today.
      expect(byId(ASSEMBLY_IDS.volunteering).createdAt).toBe('2026-01-19T09:00:00.000Z');
      expect(byId(ASSEMBLY_IDS.feedback).createdAt).toBe('2026-11-13T09:00:00.000Z');
      expect(care.fromThemeId).toBeDefined();
    } finally {
      await env.close();
    }
  });
});
