import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { MeResponse } from '@unite/shared';
import { api } from './api';

interface MeState {
  me: MeResponse | undefined;
  refresh: () => Promise<void>;
}

const MeContext = createContext<MeState>({ me: undefined, refresh: async () => {} });

/** Who I am (GET /api/me), shared by every page. */
export function MeProvider({ children, initial }: { children: ReactNode; initial?: MeResponse }) {
  const [me, setMe] = useState<MeResponse | undefined>(initial);
  const refresh = useCallback(async () => {
    try {
      setMe(await api.get<MeResponse>('/api/me'));
    } catch {
      // Unite can still be read without it.
    }
  }, []);
  useEffect(() => {
    if (!initial) void refresh();
  }, [initial, refresh]);
  return <MeContext.Provider value={{ me, refresh }}>{children}</MeContext.Provider>;
}

export const useMe = () => useContext(MeContext);
