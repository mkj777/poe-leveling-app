import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { GameDataBundle } from '../data';
import { Data, setGameData } from '../data';

const SNAPSHOT = path.resolve(__dirname, '../__fixtures__/snapshot-b7b2dd0');

function readJson(name: string) {
  return JSON.parse(
    fs.readFileSync(path.join(SNAPSHOT, 'json', `${name}.json`), 'utf8')
  );
}

const bundle: GameDataBundle = {
  Areas: readJson('areas'),
  AwakenedGemLookup: readJson('awakened-gem-lookup'),
  Characters: readJson('characters'),
  GemColours: readJson('gem-colours'),
  Gems: readJson('gems'),
  KillWaypoints: readJson('kill-waypoints'),
  Quests: readJson('quests'),
  VaalGemLookup: readJson('vaal-gem-lookup')
};

// The state is module-wide. Other test files run in their own modules, but
// clean-up happens here anyway so the order stays irrelevant.
afterEach(() => setGameData(bundle));

const KEYS = [
  'Areas',
  'AwakenedGemLookup',
  'Characters',
  'GemColours',
  'Gems',
  'KillWaypoints',
  'Quests',
  'VaalGemLookup'
] as const;

describe('Data before loading', () => {
  it('throws on every access instead of silently returning undefined', async () => {
    // A fresh module instead of a set state: only then is the state the real
    // one the app starts in. Exactly this guard made the white window
    // explainable when the persisted route wanted to render before
    // setGameData.
    vi.resetModules();
    const fresh = await import('../data');

    for (const key of KEYS) {
      expect(() => fresh.Data[key]).toThrowError(/setGameData/);
    }
  });

  it('throws as well when undefined was set', async () => {
    vi.resetModules();
    const fresh = await import('../data');
    fresh.setGameData(undefined as unknown as GameDataBundle);

    expect(() => fresh.Data.Areas).toThrowError(/setGameData/);
  });
});

describe('Data after loading', () => {
  it('passes every part of the bundle through', () => {
    setGameData(bundle);

    for (const key of KEYS) {
      expect(Data[key]).toBe(bundle[key]);
    }
  });

  it('accepts a second call and replaces the state', () => {
    const empty = Object.fromEntries(
      KEYS.map((key) => [key, {}])
    ) as unknown as GameDataBundle;

    setGameData(empty);
    expect(Data.Areas).toEqual({});

    setGameData(bundle);
    expect(Data.Areas).toBe(bundle.Areas);
  });
});
