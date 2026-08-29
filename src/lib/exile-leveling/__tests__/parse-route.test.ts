import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { GameDataBundle } from '../data';
import type { Fragments, RouteData } from '../types';
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

    const actual = buildDefaultRoute(readRoutes(), readBundle(), 'league-start');

    expect(JSON.parse(JSON.stringify(actual))).toEqual(expected);
  });

  it('enthält keine Gem-Schritte', () => {
    const actual = buildDefaultRoute(readRoutes(), readBundle(), 'league-start');
    const types = actual.sections.flatMap((section) =>
      section.steps.map((step) => step.type)
    );

    expect(types).not.toContain('gem_step');
  });

  it('nimmt den LEAGUE_START-Zweig und die Alira-Variante', () => {
    const flat = JSON.stringify(
      buildDefaultRoute(readRoutes(), readBundle(), 'league-start')
    );

    expect(flat).toContain('Hailrake');
    expect(flat).toContain('Alira Darktongue');
    expect(flat).toContain('Kraityn, Scarbearer');
  });
});

describe('buildDefaultRoute im Speedleveling', () => {
  const speed = () =>
    buildDefaultRoute(readRoutes(), readBundle(), 'speedleveling');

  function fragmentSteps(route: RouteData.Route) {
    return route.sections
      .flatMap((section) => section.steps)
      .filter(
        (step): step is RouteData.FragmentStep => step.type === 'fragment_step'
      );
  }

  it('kuerzt die Route auf die gemessene Groesse', () => {
    // 488 Schritte auf 248 Kanten werden zu 409 auf 236. Die 12 Kanten weniger
    // sind die Ligastart-Umwege, die der Preprocessor wegnimmt, die 79
    // Schritte weniger diese Umwege plus die 40 Craftingschritte, die danach
    // noch stehen.
    const route = speed();

    expect(fragmentSteps(route)).toHaveLength(409);
    expect(route.edges).toHaveLength(236);
  });

  it('laesst die Ligastart-Umwege weg', () => {
    const flat = JSON.stringify(speed());

    expect(flat).not.toContain('Hailrake');
    expect(flat).not.toContain('Chemist');
    // Die Bandit-Wahl haengt nicht daran und bleibt.
    expect(flat).toContain('Alira Darktongue');
  });

  it('laesst weder Crafting noch Trial uebrig', () => {
    const types = fragmentSteps(speed())
      .flatMap((step) => [step, ...step.subSteps])
      .flatMap((step) => step.parts)
      .filter(
        (part): part is Exclude<Fragments.AnyFragment, string> =>
          typeof part !== 'string'
      )
      .map((part) => part.type);

    expect(types).not.toContain('crafting');
    expect(types).not.toContain('trial');
  });

  it('haelt jede Kante besetzt', () => {
    // Jede Kante braucht ihren Kopfschritt, sonst findet selectPending sie
    // nicht mehr und das Overlay bliebe leer.
    const route = speed();
    const heads = new Set(
      fragmentSteps(route)
        .map((step) => step.edgeIndex)
        .filter((edge): edge is number => edge !== null)
    );

    expect(heads.size).toBe(route.edges.length);
  });
});
