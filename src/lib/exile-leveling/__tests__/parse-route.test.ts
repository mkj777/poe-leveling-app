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

  it('trifft mit demselben Kantenindex eine andere Zone als der Ligastart', () => {
    // Der Grund, warum das Overlay die Lesart zu jeder Meldung mitbekommt und
    // nicht nur beim Wechsel. Der Index, der im Speedleveling The Sarn
    // Ramparts meint, meint im Ligastart eine Zone zehn Kanten frueher, The
    // Causeway. Wer nur die Zahl schickt, verschiebt das Overlay stumm.
    const league = buildDefaultRoute(readRoutes(), readBundle(), 'league-start');
    const sarnRamparts = speed().edges.indexOf('2_8_1');

    expect(sarnRamparts).toBeGreaterThan(-1);
    expect(league.edges[sarnRamparts]).not.toBe('2_8_1');
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

describe('der Weg bleibt begehbar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Der Upstream-Parser prueft selbst, ob die Route zusammenhaengt: er warnt
   * bei `not connected to current area`, bei fehlenden und bei ungenutzten
   * Wegpunkten. Genau daran haengt der automatische Vorlauf, denn advanceEdge
   * rueckt nur vor, wenn Client.txt die naechste Kante meldet.
   */
  function meldungen(mode: 'league-start' | 'speedleveling'): string[] {
    const gesammelt: string[] = [];
    const sammeln = (...teile: unknown[]) => {
      gesammelt.push(teile.join(' '));
    };

    vi.spyOn(console, 'warn').mockImplementation(sammeln);
    vi.spyOn(console, 'error').mockImplementation(sammeln);
    vi.spyOn(console, 'log').mockImplementation(sammeln);

    buildDefaultRoute(readRoutes(), readBundle(), mode);
    vi.restoreAllMocks();

    // Craftingbereiche, die niemand einsammelt, sind im Speedleveling der
    // Normalfall und keine Beanstandung am Weg.
    return gesammelt.filter((zeile) => !zeile.includes('missing crafting area'));
  }

  it('meldet im Ligastart nichts', () => {
    expect(meldungen('league-start')).toEqual([]);
  });

  it('meldet im Speedleveling nichts', () => {
    // Ohne LEAGUE_START faellt jeder Umweg weg, und Upstream haelt die Route
    // mit eigenen #ifndef-Zweigen zusammen. Bricht das, sind Zonen nicht mehr
    // verbunden, und der Fortschritt bliebe stehen, statt vorzuruecken.
    expect(meldungen('speedleveling')).toEqual([]);
  });

  it('jede Kante hat einen Kopfschritt, an dem der Vorlauf greift', () => {
    for (const mode of ['league-start', 'speedleveling'] as const) {
      const route = buildDefaultRoute(readRoutes(), readBundle(), mode);
      const kanten = new Set(
        route.sections
          .flatMap((section) => section.steps)
          .filter(
            (step): step is RouteData.FragmentStep =>
              step.type === 'fragment_step' && step.edgeIndex !== null
          )
          .map((step) => step.edgeIndex)
      );

      expect(kanten.size, mode).toBe(route.edges.length);
    }
  });

  it('nennt keine Zone zweimal hintereinander', () => {
    // Client.txt meldet nur beim Betreten. Staenden zwei gleiche Zonen
    // nebeneinander, muesste man sie verlassen und neu betreten, um
    // vorzuruecken.
    for (const mode of ['league-start', 'speedleveling'] as const) {
      const { edges } = buildDefaultRoute(readRoutes(), readBundle(), mode);
      const doppelt = edges.filter(
        (area, index) => index > 0 && edges[index - 1] === area
      );

      expect(doppelt, mode).toEqual([]);
    }
  });
});
