import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { RouteData } from '@/lib/exile-leveling';
import {
  advanceEdge,
  flattenSteps,
  reanchorEdge,
  selectSegment
} from '../route-progress';

const EDGES = ['1_1_1', '1_1_town', '1_1_2', '1_1_town', '1_1_3'];

function step(
  edgeIndex: number | null,
  text: string
): RouteData.FragmentStep {
  return { type: 'fragment_step', parts: [text], subSteps: [], edgeIndex };
}

describe('advanceEdge', () => {
  it('laeuft vor, wenn die naechste Kante passt', () => {
    expect(advanceEdge(EDGES, 0, '1_1_town')).toBe(1);
  });

  it('bleibt stehen, wenn die Zone nicht die naechste Kante ist', () => {
    expect(advanceEdge(EDGES, 0, '1_1_3')).toBe(0);
  });

  it('springt bei wiederholter Zone nicht zurueck', () => {
    expect(advanceEdge(EDGES, 2, '1_1_town')).toBe(3);
    expect(advanceEdge(EDGES, 3, '1_1_town')).toBe(3);
  });

  it('laeuft am Ende nicht ueber', () => {
    expect(advanceEdge(EDGES, 4, '1_1_3')).toBe(4);
  });
});

describe('reanchorEdge', () => {
  it('findet den hoechsten passenden Index', () => {
    expect(reanchorEdge(EDGES, '1_1_town', 0)).toBe(3);
  });

  it('nutzt den Rueckfall, wenn die Zone unbekannt ist', () => {
    expect(reanchorEdge(EDGES, '9_9_9', 2)).toBe(2);
  });
});

describe('flattenSteps', () => {
  it('zieht die Schritte aller Sektionen zusammen', () => {
    const sections: RouteData.Section[] = [
      { name: 'Act 1', steps: [step(0, 'a'), step(null, 'b')] },
      { name: 'Act 2', steps: [step(1, 'c')] }
    ];

    expect(flattenSteps(sections).map((s) => s.parts[0])).toEqual([
      'a',
      'b',
      'c'
    ]);
  });
});

describe('selectSegment', () => {
  const steps = [
    step(0, 'betrete A'),
    step(null, 'toete X'),
    step(null, 'gib Quest ab'),
    step(1, 'betrete B'),
    step(null, 'hole Waypoint')
  ];

  it('nimmt den Kantenschritt und alles ohne eigenen Zonenwechsel', () => {
    expect(selectSegment(steps, 0).map((s) => s.parts[0])).toEqual([
      'betrete A',
      'toete X',
      'gib Quest ab'
    ]);
  });

  it('endet am Ende der Liste', () => {
    expect(selectSegment(steps, 1).map((s) => s.parts[0])).toEqual([
      'betrete B',
      'hole Waypoint'
    ]);
  });

  it('gibt nichts zurueck, wenn die Kante nicht vorkommt', () => {
    expect(selectSegment(steps, 99)).toEqual([]);
  });

  it('deckt jede Kante der echten Route ab', () => {
    const route = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../lib/exile-leveling/__fixtures__/route-b7b2dd0.json'
        ),
        'utf8'
      )
    ) as RouteData.Route;

    const all = flattenSteps(route.sections);

    for (let edge = 0; edge < route.edges.length; edge++) {
      expect(selectSegment(all, edge).length).toBeGreaterThan(0);
    }
  });
});
