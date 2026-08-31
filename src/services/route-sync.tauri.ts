import type { CachedData, SyncDeps, UpstreamStatus } from './route-sync';

import { invoke } from '@tauri-apps/api/core';

// Bewusst eine eigene Datei: route-sync.ts bleibt damit frei von
// Tauri-Importen und im Node-Testlauf ladbar.
export const tauriDeps: SyncDeps = {
  checkUpstream: () => invoke<UpstreamStatus>('check_upstream'),
  fetchUpstream: (sha) => invoke<void>('fetch_upstream', { sha }),
  readCached: () => invoke<CachedData | null>('read_cached')
};
