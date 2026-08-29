import type { CachedData, SyncDeps, UpstreamStatus } from './route-sync';
import type { GuideMode } from '@/utilities/guide-mode';
import type { RouteData } from '@/lib/exile-leveling';

import { invoke } from '@tauri-apps/api/core';
import { parseCached } from './route-sync';

// Bewusst eine eigene Datei: route-sync.ts bleibt damit frei von
// Tauri-Importen und im Node-Testlauf ladbar.
export const tauriDeps: SyncDeps = {
  checkUpstream: () => invoke<UpstreamStatus>('check_upstream'),
  fetchUpstream: (sha) => invoke<void>('fetch_upstream', { sha }),
  readCached: () => invoke<CachedData | null>('read_cached')
};

/**
 * Nur den lokalen Cache lesen und parsen, ohne Upstream zu fragen. Das
 * Overlay-Fenster braucht die Route, aber nicht den taeglichen Abgleich, den
 * das Hauptfenster ohnehin macht.
 */
export async function loadRouteFromCache(mode: GuideMode): Promise<{
  route: RouteData.Route;
  sha: string;
} | null> {
  const cached = await tauriDeps.readCached();
  if (cached === null) return null;

  try {
    return { route: parseCached(cached, mode), sha: cached.sha };
  } catch {
    return null;
  }
}
