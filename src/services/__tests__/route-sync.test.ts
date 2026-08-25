import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { CachedData } from '../route-sync';
import { syncRoute } from '../route-sync';

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
  it('laedt nichts, wenn Upstream unveraendert ist', async () => {
    const fetchUpstream = vi.fn(async () => undefined);

    const result = await syncRoute({
      checkUpstream: async () => ({ changed: false, sha: 'b7b2dd0' }),
      fetchUpstream,
      readCached: async () => cached()
    });

    expect(fetchUpstream).not.toHaveBeenCalled();
    expect(result.status).toBe('unchanged');
    expect(result.route?.sections).toHaveLength(10);
  });

  it('laedt und parst, wenn Upstream neu ist', async () => {
    const fetchUpstream = vi.fn(async () => undefined);

    const result = await syncRoute({
      checkUpstream: async () => ({ changed: true, sha: 'deadbee' }),
      fetchUpstream,
      readCached: async () => cached('deadbee')
    });

    expect(fetchUpstream).toHaveBeenCalledWith('deadbee');
    expect(result.status).toBe('updated');
    expect(result.sha).toBe('deadbee');
    expect(result.route?.edges).toHaveLength(248);
  });

  it('faellt bei Netzfehler auf den Cache zurueck', async () => {
    const result = await syncRoute({
      checkUpstream: async () => {
        throw new Error('offline');
      },
      fetchUpstream: async () => undefined,
      readCached: async () => cached()
    });

    expect(result.status).toBe('offline');
    expect(result.route?.sections).toHaveLength(10);
  });

  it('meldet Fehler, wenn weder Netz noch Cache da sind', async () => {
    const result = await syncRoute({
      checkUpstream: async () => {
        throw new Error('offline');
      },
      fetchUpstream: async () => undefined,
      readCached: async () => null
    });

    expect(result.status).toBe('error');
    expect(result.route).toBeNull();
  });

  it('meldet Fehler, wenn der Cache beschaedigt ist', async () => {
    const broken = cached();
    broken.json['areas'] = '{ das ist kein json';

    const result = await syncRoute({
      checkUpstream: async () => ({ changed: false, sha: 'b7b2dd0' }),
      fetchUpstream: async () => undefined,
      readCached: async () => broken
    });

    expect(result.status).toBe('error');
    expect(result.route).toBeNull();
    expect(result.sha).toBe('b7b2dd0');
  });
});
