import type { GameDataBundle, RouteData } from '@/lib/exile-leveling';
import type { GuideMode } from '@/utilities/guide-mode';

import { buildDefaultRoute } from '@/lib/exile-leveling/build-route';
import { withShortcutHint } from '@/utilities/shortcut-hint';

export interface UpstreamStatus {
  changed: boolean;
  sha: string;
}

export interface CachedData {
  sha: string;
  routes: string[];
  json: Record<string, string>;
}

// Passed in as dependencies so the flow is testable without Tauri.
export interface SyncDeps {
  checkUpstream: () => Promise<UpstreamStatus>;
  fetchUpstream: (sha: string) => Promise<void>;
  readCached: () => Promise<CachedData | null>;
}

export type SyncStatus = 'updated' | 'unchanged' | 'offline' | 'error';

export interface SyncResult {
  status: SyncStatus;
  route: RouteData.Route | null;
  sha: string | null;
  error: string | null;
}

export function parseCached(
  cached: CachedData,
  mode: GuideMode
): RouteData.Route {
  const bundle: GameDataBundle = {
    Areas: JSON.parse(cached.json['areas']),
    AwakenedGemLookup: JSON.parse(cached.json['awakened-gem-lookup']),
    Characters: JSON.parse(cached.json['characters']),
    GemColours: JSON.parse(cached.json['gem-colours']),
    Gems: JSON.parse(cached.json['gems']),
    KillWaypoints: JSON.parse(cached.json['kill-waypoints']),
    Quests: JSON.parse(cached.json['quests']),
    VaalGemLookup: JSON.parse(cached.json['vaal-gem-lookup'])
  };

  // The shortcut hint does not come from the route, see shortcut-hint.ts.
  return withShortcutHint(buildDefaultRoute(cached.routes, bundle, mode));
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Reads the local cache and parses it in the requested mode. Does not ask
 * upstream.
 *
 * This is the path for a mode switch: the data is the same, only the mode
 * differs. A network access for that would be waiting time with nothing
 * gained, and exactly that is what the switch used to hang on, including a
 * time limit reqwest does not have.
 *
 * Always returns a result and never throws. That is the whole point: the
 * caller derives the state from it, and a propagated exception would leave it
 * stuck on "loading".
 */
export async function loadRoute(
  deps: Pick<SyncDeps, 'readCached'>,
  mode: GuideMode
): Promise<SyncResult> {
  let cached: CachedData | null;
  try {
    cached = await deps.readCached();
  } catch (error) {
    return {
      status: 'error',
      route: null,
      sha: null,
      error: describeError(error)
    };
  }

  if (cached === null) {
    return {
      status: 'error',
      route: null,
      sha: null,
      error: 'No cached data and no network'
    };
  }

  try {
    return {
      status: 'unchanged',
      route: parseCached(cached, mode),
      sha: cached.sha,
      error: null
    };
  } catch (error) {
    return {
      status: 'error',
      route: null,
      sha: cached.sha,
      error: describeError(error)
    };
  }
}

/** Syncs with upstream, then loads. The daily path (ADR-0001). */
export async function syncRoute(
  deps: SyncDeps,
  mode: GuideMode
): Promise<SyncResult> {
  let status: SyncStatus = 'unchanged';

  try {
    const upstream = await deps.checkUpstream();
    if (upstream.changed) {
      await deps.fetchUpstream(upstream.sha);
      status = 'updated';
    }
  } catch {
    // A network error or rate limit is no reason to stand there without a
    // guide. The cache carries on, the next tick tries again.
    status = 'offline';
  }

  const result = await loadRoute(deps, mode);

  // A read error weighs more than the status from the sync.
  return result.status === 'error' ? result : { ...result, status };
}
