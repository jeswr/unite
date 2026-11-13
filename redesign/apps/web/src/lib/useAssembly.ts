import type { AssemblyView } from '@unite/shared';
import { useApi } from './api';

/** The assembly view for a slug (GET /api/assemblies/:slug), refetched when `refreshKey` changes. */
export function useAssembly(slug: string | undefined, refreshKey?: unknown) {
  return useApi<AssemblyView>(slug ? `/api/assemblies/${encodeURIComponent(slug)}` : null, refreshKey);
}
