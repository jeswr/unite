import { useEffect, useState } from 'react';
import { api } from './api';

/** How often live pages ask whether anything in the assembly has changed. */
export const LIVE_INTERVAL_MS = 2000;

/**
 * Polls GET /api/assemblies/:slug/version every 2 seconds while the page is visible and returns
 * the version. Pass it as `refreshKey` to `useApi` so the page refetches when it changes.
 */
export function useLive(slug: string | undefined, intervalMs = LIVE_INTERVAL_MS): number | undefined {
  const [version, setVersion] = useState<number>();
  useEffect(() => {
    if (!slug) return;
    let live = true;
    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const { version: v } = await api.get<{ version: number }>(`/api/assemblies/${encodeURIComponent(slug)}/version`);
        if (live) setVersion(v);
      } catch {
        // Offline for a moment: try again on the next tick.
      }
    };
    void tick();
    const timer = setInterval(tick, intervalMs);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [slug, intervalMs]);
  return version;
}
