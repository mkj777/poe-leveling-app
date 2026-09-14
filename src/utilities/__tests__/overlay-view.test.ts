import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { Fragments, RouteData } from '@/lib/exile-leveling';
import {
  EMPTY_OVERLAY_VIEW,
  buildOverlayView,
  toLineView,
  toStepView
} from '../overlay-view';
import { ICON_SOURCES } from '../fragment-style';
import { setGameData } from '@/lib/exile-leveling';

const SNAPSHOT = path.resolve(
  __dirname,
  '../../lib/exile-leveling/__fixtures__/snapshot-b7b2dd0'
);

function readJson(name: string) {
  return JSON.parse(
    fs.readFileSync(path.join(SNAPSHOT, 'json', `${name}.json`), 'utf8')
  );
}

beforeAll(() => {
  setGameData({
    Areas: readJson('areas'),
    AwakenedGemLookup: readJson('awakened-gem-lookup'),
    Characters: readJson('characters'),
    GemColours: readJson('gem-colours'),
    Gems: readJson('gems'),
    KillWaypoints: readJson('kill-waypoints'),
    Quests: readJson('quests'),
    VaalGemLookup: readJson('vaal-gem-lookup')
  });
});

function step(
  parts: Fragments.AnyFragment[],
  subSteps: Fragments.AnyFragment[][] = [],
  edgeIndex: number | null = null
): RouteData.FragmentStep {
  return {
    type: 'fragment_step',
    parts,
    subSteps: subSteps.map((sub) => ({
      type: 'fragment_step' as const,
      parts: sub,
      subSteps: [],
      edgeIndex: null
    })),
    edgeIndex
  };
}

describe('toLineView', () => {
  it('turns every fragment into text, colour and icon', () => {
    expect(
      toLineView(['Go to ', { type: 'enter', areaId: '1_1_town' }])
    ).toEqual([
      { text: 'Go to ', colour: 'plain', icon: null },
      { text: "Lioneye's Watch", colour: 'area', icon: 'town' }
    ]);
  });

  it('names icons instead of sending addresses from the bundle', () => {
    // An address like /assets/quest-BQCG-isT.png belongs to the build. The
    // name crosses the window boundary, the window looks up the image itself.
    const [icon] = toLineView([{ type: 'trial' }]);

    expect(icon.icon).toBe('trial');
    expect(ICON_SOURCES[icon.icon!]).toBeTruthy();
  });

  it('survives an empty line', () => {
    expect(toLineView([])).toEqual([]);
  });
});

describe('toStepView', () => {
  it('takes the substeps along', () => {
    const view = toStepView(
      step(['Kill ', { type: 'kill', value: 'Merveil' }], [['Go north']])
    );

    expect(view.parts).toHaveLength(2);
    expect(view.subSteps).toEqual([[{ text: 'Go north', colour: 'plain', icon: null }]]);
  });

  it('leaves the edge index out, the overlay does not need it', () => {
    expect(Object.keys(toStepView(step(['x'], [], 5)))).toEqual([
      'parts',
      'subSteps'
    ]);
  });
});

describe('buildOverlayView', () => {
  const route: RouteData.Route = {
    edges: ['1_1_1', '1_1_2', '1_1_town'],
    sections: [
      {
        name: 'Act 1',
        steps: [
          step([{ type: 'enter', areaId: '1_1_1' }], [], 0),
          step([{ type: 'enter', areaId: '1_1_2' }], [], 1),
          step(['Kill ', { type: 'kill', value: 'Hillock' }]),
          step([{ type: 'enter', areaId: '1_1_town' }], [], 2)
        ]
      }
    ]
  };

  it('shows what is pending after the current edge', () => {
    const view = buildOverlayView(route, 1);

    expect(view.act).toBe('Act 1');
    expect(view.steps).toHaveLength(2);
    expect(view.steps[0].parts.map((part) => part.text).join('')).toBe(
      'Kill Hillock'
    );
  });

  it('counts the edge steps still to come in the act', () => {
    expect(buildOverlayView(route, 0).stepsLeft).toBe(2);
    expect(buildOverlayView(route, 2).stepsLeft).toBe(0);
  });

  it('names no act when the edge lies in none', () => {
    const view = buildOverlayView(route, 99);

    expect(view.act).toBeNull();
    expect(view.stepsLeft).toBe(0);
  });

  it('crosses the window boundary as JSON without losing anything on the way', () => {
    // The point of the whole model: the overlay receives it as an event.
    const view = buildOverlayView(route, 1);

    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  it('keeps an empty view ready while no route is there', () => {
    expect(EMPTY_OVERLAY_VIEW.steps).toEqual([]);
    expect(EMPTY_OVERLAY_VIEW.act).toBeNull();
  });
});
