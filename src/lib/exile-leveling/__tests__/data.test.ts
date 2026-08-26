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

// Der Zustand ist modulweit. Andere Testdateien laufen in eigenen Modulen,
// hier wird trotzdem aufgeraeumt, damit die Reihenfolge egal bleibt.
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

describe('Data vor dem Laden', () => {
  it('wirft bei jedem Zugriff, statt still undefined zu liefern', async () => {
    // Frisches Modul statt gesetztem Zustand: nur so ist der Zustand echt,
    // in dem die App startet. Genau dieser Riegel hat das weisse Fenster
    // erklaerbar gemacht, als die persistierte Route vor setGameData rendern
    // wollte.
    vi.resetModules();
    const frisch = await import('../data');

    for (const key of KEYS) {
      expect(() => frisch.Data[key]).toThrowError(/setGameData/);
    }
  });

  it('wirft auch, wenn undefined gesetzt wurde', async () => {
    vi.resetModules();
    const frisch = await import('../data');
    frisch.setGameData(undefined as unknown as GameDataBundle);

    expect(() => frisch.Data.Areas).toThrowError(/setGameData/);
  });
});

describe('Data nach dem Laden', () => {
  it('reicht jeden Teil des Bundles durch', () => {
    setGameData(bundle);

    for (const key of KEYS) {
      expect(Data[key]).toBe(bundle[key]);
    }
  });

  it('nimmt einen zweiten Aufruf an und ersetzt den Stand', () => {
    const leer = Object.fromEntries(
      KEYS.map((key) => [key, {}])
    ) as unknown as GameDataBundle;

    setGameData(leer);
    expect(Data.Areas).toEqual({});

    setGameData(bundle);
    expect(Data.Areas).toBe(bundle.Areas);
  });
});
