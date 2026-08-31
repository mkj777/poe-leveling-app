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
  it('macht aus jedem Fragment Text, Farbe und Symbol', () => {
    expect(
      toLineView(['Go to ', { type: 'enter', areaId: '1_1_town' }])
    ).toEqual([
      { text: 'Go to ', colour: 'plain', icon: null },
      { text: "Lioneye's Watch", colour: 'area', icon: 'town' }
    ]);
  });

  it('benennt Symbole, statt Adressen aus dem Buendel zu verschicken', () => {
    // Eine Adresse wie /assets/quest-BQCG-isT.png gehoert dem Build. Ueber die
    // Fenstergrenze geht der Name, das Bild sucht sich das Fenster selbst.
    const [icon] = toLineView([{ type: 'trial' }]);

    expect(icon.icon).toBe('trial');
    expect(ICON_SOURCES[icon.icon!]).toBeTruthy();
  });

  it('ueberlebt eine leere Zeile', () => {
    expect(toLineView([])).toEqual([]);
  });
});

describe('toStepView', () => {
  it('nimmt die Unterschritte mit', () => {
    const view = toStepView(
      step(['Kill ', { type: 'kill', value: 'Merveil' }], [['Go north']])
    );

    expect(view.parts).toHaveLength(2);
    expect(view.subSteps).toEqual([[{ text: 'Go north', colour: 'plain', icon: null }]]);
  });

  it('laesst den Kantenindex weg, den braucht das Overlay nicht', () => {
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

  it('zeigt, was nach der aktuellen Kante ansteht', () => {
    const view = buildOverlayView(route, 1);

    expect(view.act).toBe('Act 1');
    expect(view.steps).toHaveLength(2);
    expect(view.steps[0].parts.map((part) => part.text).join('')).toBe(
      'Kill Hillock'
    );
  });

  it('zaehlt die Kantenschritte, die im Akt noch kommen', () => {
    expect(buildOverlayView(route, 0).stepsLeft).toBe(2);
    expect(buildOverlayView(route, 2).stepsLeft).toBe(0);
  });

  it('nennt keinen Akt, wenn die Kante in keinem liegt', () => {
    const view = buildOverlayView(route, 99);

    expect(view.act).toBeNull();
    expect(view.stepsLeft).toBe(0);
  });

  it('geht als JSON ueber die Fenstergrenze, ohne unterwegs etwas zu verlieren', () => {
    // Der Sinn des ganzen Modells: das Overlay bekommt es als Ereignis.
    const view = buildOverlayView(route, 1);

    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  it('haelt eine leere Anzeige bereit, solange keine Route da ist', () => {
    expect(EMPTY_OVERLAY_VIEW.steps).toEqual([]);
    expect(EMPTY_OVERLAY_VIEW.act).toBeNull();
  });
});
