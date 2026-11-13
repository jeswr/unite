import type { Deps } from './deps.js';
import { notFound } from './errors.js';

/**
 * Every write under an assembly calls this, so live pages polling GET /api/assemblies/:slug/version
 * see the change. Returns the new version.
 */
export async function bumpVersion(deps: Pick<Deps, 'store' | 'clock'>, assemblyId: string): Promise<number> {
  return deps.store.transaction(async (tx) => {
    const a = await tx.get('assemblies', assemblyId);
    if (!a) throw notFound('That assembly');
    const version = a.version + 1;
    await tx.put('assemblies', { ...a, version, updatedAt: deps.clock.iso() });
    return version;
  });
}
