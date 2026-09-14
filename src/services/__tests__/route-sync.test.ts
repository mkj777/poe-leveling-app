import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { CachedData, SyncDeps } from '../route-sync';
import type { RouteData } from '@/lib/exile-leveling';
import { OVERLAY_SHORTCUT_HINT } from '@/utilities/shortcut-hint';
import { loadRoute, syncRoute } from '../route-sync';

const SNAPSHOT = path.resolve(
  __dirname,
  '../../lib/exile-leveling/__fixtures__/snapshot-b7b2dd0'
);

const JSON_NAMES = [
  'areas',
  'awakened-gem-lookup',
  'characters',
  'gem-colours',
  'gems',
  'kill-waypoints',
  'quests',
  'vaal-gem-lookup'
];

function cached(sha = 'b7b2dd0'): CachedData {
  return {
    sha,
    routes: Array.from({ length: 10 }, (_value, index) =>
      fs.readFileSync(
        path.join(SNAPSHOT, 'routes', `act-${index + 1}.txt`),
        'utf8'
      )
    ),
    json: Object.fromEntries(
      JSON_NAMES.map((name) => [
        name,
        fs.readFileSync(path.join(SNAPSHOT, 'json', `${name}.json`), 'utf8')
      ])
    )
  };
}

describe('syncRoute', () => {
  it('downloads nothing when upstream is unchanged', async () => {
    const fetchUpstream = vi.fn(async () => undefined);

    const result = await syncRoute({
      checkUpstream: async () => ({ changed: false, sha: 'b7b2dd0' }),
      fetchUpstream,
      readCached: async () => cached()
    }, 'league-start');

    expect(fetchUpstream).not.toHaveBeenCalled();
    expect(result.status).toBe('unchanged');
    expect(result.route?.sections).toHaveLength(10);
  });

  it('downloads and parses when upstream is new', async () => {
    const fetchUpstream = vi.fn(async () => undefined);

    const result = await syncRoute({
      checkUpstream: async () => ({ changed: true, sha: 'deadbee' }),
      fetchUpstream,
      readCached: async () => cached('deadbee')
    }, 'league-start');

    expect(fetchUpstream).toHaveBeenCalledWith('deadbee');
    expect(result.status).toBe('updated');
    expect(result.sha).toBe('deadbee');
    expect(result.route?.edges).toHaveLength(248);
  });

  it('falls back to the cache on a network error', async () => {
    const result = await syncRoute({
      checkUpstream: async () => {
        throw new Error('offline');
      },
      fetchUpstream: async () => undefined,
      readCached: async () => cached()
    }, 'league-start');

    expect(result.status).toBe('offline');
    expect(result.route?.sections).toHaveLength(10);
  });

  it('reports an error when neither network nor cache is there', async () => {
    const result = await syncRoute({
      checkUpstream: async () => {
        throw new Error('offline');
      },
      fetchUpstream: async () => undefined,
      readCached: async () => null
    }, 'league-start');

    expect(result.status).toBe('error');
    expect(result.route).toBeNull();
  });

  it('names a failure that is not an Error object too', async () => {
    // parseCached calls foreign code. If it throws a string, that must not
    // become "undefined" in the message.
    const result = await syncRoute({
      checkUpstream: async () => ({ changed: false, sha: 'b7b2dd0' }),
      fetchUpstream: async () => undefined,
      readCached: async () => {
        throw 'broken without Error';
      }
    }, 'league-start');

    expect(result.status).toBe('error');
    expect(result.error).toContain('broken without Error');
  });

  it('reports an error when the cache is corrupted', async () => {
    const broken = cached();
    broken.json['areas'] = '{ this is not json';

    const result = await syncRoute({
      checkUpstream: async () => ({ changed: false, sha: 'b7b2dd0' }),
      fetchUpstream: async () => undefined,
      readCached: async () => broken
    }, 'league-start');

    expect(result.status).toBe('error');
    expect(result.route).toBeNull();
    expect(result.sha).toBe('b7b2dd0');
  });
});

describe('loadRoute', () => {
  it('does not ask upstream at all', async () => {
    // The path for the mode switch. The data is the same, only the mode
    // differs, and a request to GitHub would be waiting time with nothing
    // gained. Exactly that is what the switch used to hang on.
    const checkUpstream = vi.fn(async () => ({ changed: true, sha: 'new' }));
    const fetchUpstream = vi.fn(async () => undefined);

    // Deliberately the full dependencies: the test should show that loadRoute
    // does not touch them although it has them.
    const deps: SyncDeps = {
      checkUpstream,
      fetchUpstream,
      readCached: async () => cached()
    };

    const result = await loadRoute(deps, 'speedleveling');

    expect(checkUpstream).not.toHaveBeenCalled();
    expect(fetchUpstream).not.toHaveBeenCalled();
    expect(result.status).toBe('unchanged');
    expect(result.route?.edges).toHaveLength(236);
  });

  it('parses in the requested mode', async () => {
    const deps = { readCached: async () => cached() };

    expect((await loadRoute(deps, 'league-start')).route?.edges).toHaveLength(
      248
    );
    expect((await loadRoute(deps, 'speedleveling')).route?.edges).toHaveLength(
      236
    );
  });

  it('reports an error when the cache is empty', async () => {
    const result = await loadRoute({ readCached: async () => null }, 'league-start');

    expect(result.status).toBe('error');
    expect(result.route).toBeNull();
  });

  it('reports an error when reading fails', async () => {
    const result = await loadRoute(
      {
        readCached: async () => {
          throw new Error('disk gone');
        }
      },
      'league-start'
    );

    expect(result.status).toBe('error');
    expect(result.error).toContain('disk gone');
  });

  it('reports an error when the cache is corrupted', async () => {
    const broken = cached();
    broken.json['areas'] = '{ this is not json';

    const result = await loadRoute({ readCached: async () => broken }, 'league-start');

    expect(result.status).toBe('error');
    expect(result.sha).toBe('b7b2dd0');
  });
});

describe('the shortcut hint', () => {
  const lastStep = (route: RouteData.Route) =>
    route.sections.at(-1)!.steps.at(-1) as RouteData.FragmentStep;

  it('hangs on the route the app displays', async () => {
    // buildDefaultRoute returns exactly what the upstream parser returns, and
    // a golden-file test pins it to that. Whatever the app shows beyond that
    // is added here.
    const result = await loadRoute(
      { readCached: async () => cached() },
      'league-start'
    );

    expect(lastStep(result.route!).subSteps.at(-1)).toEqual(
      OVERLAY_SHORTCUT_HINT
    );
  });

  it('hangs on in both modes', async () => {
    const result = await loadRoute(
      { readCached: async () => cached() },
      'speedleveling'
    );

    expect(lastStep(result.route!).subSteps.at(-1)).toEqual(
      OVERLAY_SHORTCUT_HINT
    );
  });
});
