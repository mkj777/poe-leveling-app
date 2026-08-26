import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { GameDataBundle } from '@/lib/exile-leveling/data';
import type { RouteData } from '@/lib/exile-leveling';
import {
  actProgress,
  advanceEdge,
  flattenSteps,
  reanchorEdge,
  selectSegment
} from '@/utilities/route-progress';
import { bench, report } from './bench';
import { buildDefaultRoute } from '@/lib/exile-leveling/build-route';
import { computeOverlayRect } from '@/utilities/overlay-geometry';
import { renderStepText } from '@/utilities/fragment-text';

const SNAPSHOT = path.resolve(
  __dirname,
  '../lib/exile-leveling/__fixtures__/snapshot-b7b2dd0'
);

function readRoutes(): string[] {
  return Array.from({ length: 10 }, (_v, i) =>
    fs.readFileSync(path.join(SNAPSHOT, 'routes', `act-${i + 1}.txt`), 'utf8')
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

let route: RouteData.Route;
let steps: RouteData.FragmentStep[];

beforeAll(() => {
  route = buildDefaultRoute(readRoutes(), readBundle());
  steps = flattenSteps(route.sections);
});

const FHD = {
  x: 0,
  y: 0,
  w: 1920,
  h: 1080,
  focused: true,
  exclusiveFullscreen: false,
  found: true
};

describe('Start der App', () => {
  it('parst die ganze Route schnell genug fuer einen Kaltstart', () => {
    // Laeuft bei jedem Start und in jedem Fenster, das die Route braucht.
    // Alles jenseits einer halben Sekunde waere als Verzoegerung spuerbar.
    const routes = readRoutes();
    const bundle = readBundle();

    const result = bench(() => buildDefaultRoute(routes, bundle), { runs: 5 });
    report('buildDefaultRoute, 10 Akte', result, 25);

    expect(result.median).toBeLessThan(25);
  });
});

describe('Anzeige eines Schritts', () => {
  // Diese drei laufen bei jedem Neuzeichnen des Overlays, und Neuzeichnen
  // passiert bei jeder Fensterbewegung des Spiels.
  it('flacht die Route pro Bild schnell genug ab', () => {
    const result = bench(() => flattenSteps(route.sections));
    report('flattenSteps, ganze Route', result, 1);

    expect(result.median).toBeLessThan(1);
  });

  it('findet das Segment einer Kante schnell genug', () => {
    const result = bench(() => selectSegment(steps, 120));
    report('selectSegment, mittlere Kante', result, 0.5);

    expect(result.median).toBeLessThan(0.5);
  });

  it('ermittelt Akt und Restschritte schnell genug', () => {
    const result = bench(() => actProgress(route.sections, 120));
    report('actProgress, mittlere Kante', result, 0.5);

    expect(result.median).toBeLessThan(0.5);
  });

  it('rendert ein ganzes Segment schnell genug', () => {
    const segment = selectSegment(steps, 120);

    const result = bench(() => {
      for (const step of segment) renderStepText(step);
    });
    report('renderStepText, ein Segment', result, 0.5);

    expect(result.median).toBeLessThan(0.5);
  });
});

describe('ganze Route auf einmal', () => {
  it('rendert jeden Schritt der Route in vertretbarer Zeit', () => {
    // Das macht die Guide-Liste im Hauptfenster beim ersten Aufbau.
    const result = bench(
      () => {
        for (const step of steps) renderStepText(step);
      },
      { runs: 10 }
    );
    report('renderStepText, alle Schritte', result, 3);

    expect(result.median).toBeLessThan(3);
  });

  it('laeuft die Route Kante fuer Kante durch, ohne quadratisch zu werden', () => {
    // Der wichtigste Schutz hier: selectSegment und actProgress suchen linear.
    // Wer sie versehentlich verschachtelt, faellt sofort auf.
    const result = bench(
      () => {
        for (let edge = 0; edge < route.edges.length; edge++) {
          selectSegment(steps, edge);
          actProgress(route.sections, edge);
        }
      },
      { runs: 5 }
    );
    report('248 Kanten, Segment und Akt', result, 25);

    expect(result.median).toBeLessThan(25);
  });
});

describe('Fortschritt aus dem Log', () => {
  it('prueft den Kantenvorlauf im Sekundentakt praktisch kostenlos', () => {
    // Laeuft jede Sekunde, solange die App scannt.
    const result = bench(
      () => {
        for (let i = 0; i < 1000; i++) {
          advanceEdge(route.edges, i % route.edges.length, '1_1_town');
        }
      },
      { runs: 10 }
    );
    report('advanceEdge, 1000 Aufrufe', result, 2);

    expect(result.median).toBeLessThan(2);
  });

  it('knuepft nach einem Refresh schnell wieder an', () => {
    const result = bench(
      () => {
        for (const area of route.edges) {
          reanchorEdge(route.edges, area, 0);
        }
      },
      { runs: 10 }
    );
    report('reanchorEdge, alle Zonen', result, 5);

    expect(result.median).toBeLessThan(5);
  });
});

describe('Geometrie des Overlays', () => {
  it('rechnet die Fensterlage weit unter einem Bild', () => {
    // Bei jedem poe-bounds-Ereignis, also potenziell bei jeder Mausbewegung
    // im Spiel. Alles ueber einer Millisekunde waere hier zu viel.
    const result = bench(
      () => {
        for (let i = 0; i < 1000; i++) {
          computeOverlayRect(FHD, 120 + (i % 200), 1, { dx: 0, dy: 0 }, 'bottom');
        }
      },
      { runs: 10 }
    );
    report('computeOverlayRect, 1000 Aufrufe', result, 3);

    expect(result.median).toBeLessThan(3);
  });
});
