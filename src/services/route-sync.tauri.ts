import type { CachedData, SyncDeps, UpstreamStatus } from './route-sync';

import { invoke } from '@tauri-apps/api/core';

// Deliberately a separate file: route-sync.ts thus stays free of Tauri
// imports and loadable in the Node test run.
export const tauriDeps: SyncDeps = {
  checkUpstream: () => invoke<UpstreamStatus>('check_upstream'),
  fetchUpstream: (sha) => invoke<void>('fetch_upstream', { sha }),
  readCached: () => invoke<CachedData | null>('read_cached')
};
