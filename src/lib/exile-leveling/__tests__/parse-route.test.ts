import { afterEach, describe, expect, it, vi } from 'vitest';
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
  it('produces exactly the route of the website', () => {
    const expected = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../__fixtures__/route-b7b2dd0.json'),
        'utf8'
      )
    );

    const actual = buildDefaultRoute(readRoutes(), readBundle(), 'league-start');

    expect(JSON.parse(JSON.stringify(actual))).toEqual(expected);
  });

  it('contains no gem steps', () => {
    const actual = buildDefaultRoute(readRoutes(), readBundle(), 'league-start');
    const types = actual.sections.flatMap((section) =>
      section.steps.map((step) => step.type)
    );

    expect(types).not.toContain('gem_step');
  });

  it('takes the LEAGUE_START branch and the Alira variant', () => {
    const flat = JSON.stringify(
      buildDefaultRoute(readRoutes(), readBundle(), 'league-start')
    );

    expect(flat).toContain('Hailrake');
    expect(flat).toContain('Alira Darktongue');
    expect(flat).toContain('Kraityn, Scarbearer');
  });
});

describe('buildDefaultRoute in speedleveling', () => {
  const speed = () =>
    buildDefaultRoute(readRoutes(), readBundle(), 'speedleveling');

  function fragmentSteps(route: RouteData.Route) {
    return route.sections
      .flatMap((section) => section.steps)
      .filter(
        (step): step is RouteData.FragmentStep => step.type === 'fragment_step'
      );
  }

  it('shortens the route to the measured size', () => {
    // 488 steps on 248 edges become 409 on 236. The 12 fewer edges are the
    // league-start detours the preprocessor removes, the 79 fewer steps are
    // those detours plus the 40 crafting steps still standing afterwards.
    const route = speed();

    expect(fragmentSteps(route)).toHaveLength(409);
    expect(route.edges).toHaveLength(236);
  });

  it('leaves out the league-start detours', () => {
    const flat = JSON.stringify(speed());

    expect(flat).not.toContain('Hailrake');
    expect(flat).not.toContain('Chemist');
    // The bandit choice does not depend on it and stays.
    expect(flat).toContain('Alira Darktongue');
  });

  it('leaves neither crafting nor trial behind', () => {
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

  it('hits a different zone than league start with the same edge index', () => {
    // The reason the overlay gets the mode with every message and not only
    // on the switch. The index that means The Sarn Ramparts in speedleveling
    // means a zone ten edges earlier at league start, The Causeway. Sending
    // only the number shifts the overlay silently.
    const league = buildDefaultRoute(readRoutes(), readBundle(), 'league-start');
    const sarnRamparts = speed().edges.indexOf('2_8_1');

    expect(sarnRamparts).toBeGreaterThan(-1);
    expect(league.edges[sarnRamparts]).not.toBe('2_8_1');
  });

  it('keeps every edge occupied', () => {
    // Every edge needs its head step, otherwise selectPending no longer finds
    // it and the overlay would stay empty.
    const route = speed();
    const heads = new Set(
      fragmentSteps(route)
        .map((step) => step.edgeIndex)
        .filter((edge): edge is number => edge !== null)
    );

    expect(heads.size).toBe(route.edges.length);
  });
});

describe('the path stays walkable', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * The upstream parser checks itself whether the route is connected: it
   * warns on `not connected to current area`, on missing and on unused
   * waypoints. The automatic advance hangs on exactly that, because
   * advanceEdge only moves on when Client.txt reports the next edge.
   */
  function warnings(mode: 'league-start' | 'speedleveling'): string[] {
    const collected: string[] = [];
    const collect = (...parts: unknown[]) => {
      collected.push(parts.join(' '));
    };

    vi.spyOn(console, 'warn').mockImplementation(collect);
    vi.spyOn(console, 'error').mockImplementation(collect);
    vi.spyOn(console, 'log').mockImplementation(collect);

    buildDefaultRoute(readRoutes(), readBundle(), mode);
    vi.restoreAllMocks();

    // Crafting areas nobody collects are the normal case in speedleveling and
    // no complaint about the path.
    return collected.filter((line) => !line.includes('missing crafting area'));
  }

  it('reports nothing at league start', () => {
    expect(warnings('league-start')).toEqual([]);
  });

  it('reports nothing in speedleveling', () => {
    // Without LEAGUE_START every detour goes, and upstream keeps the route
    // together with its own #ifndef branches. If that breaks, zones are no
    // longer connected and progress would stall instead of advancing.
    expect(warnings('speedleveling')).toEqual([]);
  });

  it('every edge has a head step the advance can grab', () => {
    for (const mode of ['league-start', 'speedleveling'] as const) {
      const route = buildDefaultRoute(readRoutes(), readBundle(), mode);
      const edges = new Set(
        route.sections
          .flatMap((section) => section.steps)
          .filter(
            (step): step is RouteData.FragmentStep =>
              step.type === 'fragment_step' && step.edgeIndex !== null
          )
          .map((step) => step.edgeIndex)
      );

      expect(edges.size, mode).toBe(route.edges.length);
    }
  });

  it('names no zone twice in a row', () => {
    // Client.txt only reports on entering. If two equal zones stood next to
    // each other, one would have to leave and re-enter to advance.
    for (const mode of ['league-start', 'speedleveling'] as const) {
      const { edges } = buildDefaultRoute(readRoutes(), readBundle(), mode);
      const repeated = edges.filter(
        (area, index) => index > 0 && edges[index - 1] === area
      );

      expect(repeated, mode).toEqual([]);
    }
  });
});
