import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { GameDataBundle } from '../data';
import { buildDefaultRoute } from '../build-route';

const SNAPSHOT = path.resolve(__dirname, '../__fixtures__/snapshot-b7b2dd0');

function readRoutes(): string[] {
  return Array.from({ length: 10 }, (_value, index) =>
    fs.readFileSync(
      path.join(SNAPSHOT, 'routes', `act-${index + 1}.txt`),
      'utf8'
    )
  );
}

function readJson(name: string) {
  return JSON.parse(
    fs.readFileSync(path.join(SNAPSHOT, 'json', `${name}.json`), 'utf8')
  );
}

function readBundle(): GameDataBundle {
  return {
    Areas: readJson('areas'),
    AwakenedGemLookup: readJson('awakened-gem-lookup'),
    Characters: readJson('characters'),
    GemColours: readJson('gem-colours'),
    Gems: readJson('gems'),
    KillWaypoints: readJson('kill-waypoints'),
    Quests: readJson('quests'),
    VaalGemLookup: readJson('vaal-gem-lookup')
  };
}

describe('buildDefaultRoute', () => {
  it('erzeugt exakt die Route der Website', () => {
    const expected = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../__fixtures__/route-b7b2dd0.json'),
        'utf8'
      )
    );

    const actual = buildDefaultRoute(readRoutes(), readBundle());

    expect(JSON.parse(JSON.stringify(actual))).toEqual(expected);
  });

  it('enthält keine Gem-Schritte', () => {
    const actual = buildDefaultRoute(readRoutes(), readBundle());
    const types = actual.sections.flatMap((section) =>
      section.steps.map((step) => step.type)
    );

    expect(types).not.toContain('gem_step');
  });

  it('nimmt den LEAGUE_START-Zweig und die Alira-Variante', () => {
    const flat = JSON.stringify(buildDefaultRoute(readRoutes(), readBundle()));

    expect(flat).toContain('Hailrake');
    expect(flat).toContain('Alira Darktongue');
    expect(flat).toContain('Kraityn, Scarbearer');
  });
});
