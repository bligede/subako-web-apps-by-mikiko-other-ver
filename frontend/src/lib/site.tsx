import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '../features/auth/AuthContext';
import type { SiteAccess } from '../types';

interface SiteValue {
  sites: SiteAccess[];
  site: SiteAccess | null;
  siteId: string;
  setSiteId: (id: string) => void;
}

const SiteContext = createContext<SiteValue | null>(null);
const STORAGE_KEY = 'subako.site';

export function SiteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const sites = user?.sites ?? [];
  const [siteId, setSiteIdState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? '',
  );

  const site = sites.find((item) => item.id === siteId) ?? sites[0] ?? null;

  useEffect(() => {
    if (site && site.id !== siteId) {
      setSiteIdState(site.id);
      localStorage.setItem(STORAGE_KEY, site.id);
    }
  }, [site, siteId]);

  const value = useMemo<SiteValue>(
    () => ({
      sites,
      site,
      siteId: site?.id ?? '',
      setSiteId: (id: string) => {
        setSiteIdState(id);
        localStorage.setItem(STORAGE_KEY, id);
      },
    }),
    [sites, site],
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteValue {
  const context = useContext(SiteContext);
  if (!context) throw new Error('useSite harus dipakai di dalam SiteProvider');
  return context;
}
