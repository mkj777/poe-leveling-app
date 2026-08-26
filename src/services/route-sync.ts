import type { GameDataBundle, RouteData } from '@/lib/exile-leveling';

import { buildDefaultRoute } from '@/lib/exile-leveling/build-route';

export interface UpstreamStatus {
  changed: boolean;
  sha: string;
}

export interface CachedData {
  sha: string;
  routes: string[];
  json: Record<string, string>;
}

// Als Abhaengigkeiten hereingereicht, damit der Ablauf ohne Tauri testbar ist.
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

export function parseCached(cached: CachedData): RouteData.Route {
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

  return buildDefaultRoute(cached.routes, bundle);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Liefert immer ein Ergebnis und wirft nie. Das ist der ganze Zweck: der
 * Aufrufer setzt daraus den Zustand, und eine durchgereichte Ausnahme wuerde
 * ihn auf "wird geladen" stehen lassen.
 */
export async function syncRoute(deps: SyncDeps): Promise<SyncResult> {
  let status: SyncStatus = 'unchanged';

  try {
    const upstream = await deps.checkUpstream();
    if (upstream.changed) {
      await deps.fetchUpstream(upstream.sha);
      status = 'updated';
    }
  } catch {
    // Netzfehler oder Rate-Limit sind kein Grund, ohne Guide dazustehen.
    // Der Cache traegt weiter, der naechste Takt versucht es erneut.
    status = 'offline';
  }

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
      error: 'Keine Daten im Cache und kein Netz'
    };
  }

  try {
    return {
      status,
      route: parseCached(cached),
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
