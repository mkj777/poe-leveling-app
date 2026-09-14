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
  selectPending
} from '@/utilities/route-progress';
import { bench, report } from './bench';
import { buildDefaultRoute } from '@/lib/exile-leveling/build-route';
import { buildOverlayView, toStepView } from '@/utilities/overlay-view';
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
  route = buildDefaultRoute(readRoutes(), readBundle(), 'league-start');
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

describe('app start', () => {
  it('parses the whole route fast enough for a cold start', () => {
    // Runs on every start and in every window that needs the route.
    // Anything beyond half a second would be noticeable as a delay.
    const routes = readRoutes();
    const bundle = readBundle();

    const result = bench(() => buildDefaultRoute(routes, bundle, 'league-start'), {
      runs: 5
    });
    report('buildDefaultRoute, 10 acts', result, 25);

    expect(result.median).toBeLessThan(25);
  });
});

describe('displaying a step', () => {
  // These three run on every redraw of the overlay, and redraws happen on
  // every movement of the game window.
  it('flattens the route fast enough per frame', () => {
    const result = bench(() => flattenSteps(route.sections));
    report('flattenSteps, whole route', result, 1);

    expect(result.median).toBeLessThan(1);
  });

  it('finds the pending steps of an edge fast enough', () => {
    const result = bench(() => selectPending(steps, 120));
    report('selectPending, middle edge', result, 0.5);

    expect(result.median).toBeLessThan(0.5);
  });

  it('determines act and remaining steps fast enough', () => {
    const result = bench(() => actProgress(route.sections, 120));
    report('actProgress, middle edge', result, 0.5);

    expect(result.median).toBeLessThan(0.5);
  });

  it('renders a whole segment fast enough', () => {
    const segment = selectPending(steps, 120);

    const result = bench(() => {
      for (const step of segment) renderStepText(step);
    });
    report('renderStepText, one segment', result, 0.5);

    expect(result.median).toBeLessThan(0.5);
  });
});

describe('whole route at once', () => {
  it('renders every step of the route in reasonable time', () => {
    // This is what the guide list in the main window does on first build.
    const result = bench(
      () => {
        for (const step of steps) renderStepText(step);
      },
      { runs: 10 }
    );
    report('renderStepText, all steps', result, 3);

    expect(result.median).toBeLessThan(3);
  });

  it('builds the view of the whole route in reasonable time', () => {
    // The guide list does this once per route, in a memo. Since the overlay
    // gets the same shape (ADR-0012), this is the real path.
    const result = bench(
      () => {
        for (const step of steps) toStepView(step);
      },
      { runs: 10 }
    );
    report('toStepView, all steps', result, 5);

    expect(result.median).toBeLessThan(5);
  });

  it('walks the route edge by edge without going quadratic', () => {
    // The most important guard here: selectPending and actProgress search
    // linearly, and buildOverlayView calls both. Nesting them by accident
    // shows up immediately.
    const result = bench(
      () => {
        for (let edge = 0; edge < route.edges.length; edge++) {
          // Exactly what the main window sends to the overlay on every zone
          // change.
          buildOverlayView(route, edge);
        }
      },
      { runs: 5 }
    );
    report('248 edges, whole overlay view', result, 25);

    expect(result.median).toBeLessThan(25);
  });
});

describe('progress from the log', () => {
  it('checks the edge advance every second practically for free', () => {
    // Runs every second while the app is scanning.
    const result = bench(
      () => {
        for (let i = 0; i < 1000; i++) {
          advanceEdge(route.edges, i % route.edges.length, '1_1_town');
        }
      },
      { runs: 10 }
    );
    report('advanceEdge, 1000 calls', result, 2);

    expect(result.median).toBeLessThan(2);
  });

  it('re-anchors quickly after a refresh', () => {
    const result = bench(
      () => {
        for (const area of route.edges) {
          reanchorEdge(route.edges, area, 0);
        }
      },
      { runs: 10 }
    );
    report('reanchorEdge, all zones', result, 5);

    expect(result.median).toBeLessThan(5);
  });
});

describe('overlay geometry', () => {
  it('computes the window position well within a frame', () => {
    // On every poe-bounds event, so potentially on every mouse movement in
    // the game. Anything above a millisecond would be too much here.
    const result = bench(
      () => {
        for (let i = 0; i < 1000; i++) {
          computeOverlayRect(FHD, 120 + (i % 200), 1, { dx: 0, dy: 0 }, 'bottom');
        }
      },
      { runs: 10 }
    );
    report('computeOverlayRect, 1000 calls', result, 3);

    expect(result.median).toBeLessThan(3);
  });
});
