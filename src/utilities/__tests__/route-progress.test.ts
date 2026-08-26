import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { RouteData } from '@/lib/exile-leveling';
import {
  actProgress,
  advanceEdge,
  flattenSteps,
  groupSteps,
  reanchorEdge,
  selectPending
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
  it('laesst den gespeicherten Index stehen, wenn er noch passt', () => {
    // Der Normalfall beim Neustart: die Daten sind unveraendert, der Index
    // zeigt weiterhin auf dieselbe Zone. Frueher sprang er hier trotzdem auf
    // das letzte Vorkommen der Zone, also mitten in den Akt hinein.
    expect(reanchorEdge(EDGES, '1_1_town', 1)).toBe(1);
    expect(reanchorEdge(EDGES, '1_1_town', 3)).toBe(3);
  });

  it('nimmt das naechstgelegene Vorkommen, nicht das letzte', () => {
    // Nur wenn der gespeicherte Index nicht mehr passt, wird gesucht. Dann
    // ist das naheliegende Vorkommen gemeint, nicht das am Ende des Aktes.
    expect(reanchorEdge(EDGES, '1_1_town', 0)).toBe(1);
    expect(reanchorEdge(EDGES, '1_1_town', 4)).toBe(3);
  });

  it('bevorzugt bei gleichem Abstand das fruehere Vorkommen', () => {
    // Zu weit vorne zu stehen kostet einen Blick, zu weit hinten laesst
    // Schritte aus.
    expect(reanchorEdge(EDGES, '1_1_town', 2)).toBe(1);
  });

  it('nutzt den Rueckfall, wenn die Zone unbekannt ist', () => {
    expect(reanchorEdge(EDGES, '9_9_9', 2)).toBe(2);
  });

  it('haelt den Fortschritt in einer Zone, die der Akt mehrfach besucht', () => {
    const route = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../lib/exile-leveling/__fixtures__/route-b7b2dd0.json'
        ),
        'utf8'
      )
    ) as RouteData.Route;

    // The Forest Encampment liegt auf den Kanten 135, 137, 145, 150 und 156.
    // Jede davon muss sich selbst wiederfinden.
    for (const edge of [135, 137, 145, 150, 156]) {
      expect(route.edges[edge]).toBe('2_6_town');
      expect(reanchorEdge(route.edges, '2_6_town', edge)).toBe(edge);
    }
  });

  it('faellt auf keiner Kante der echten Route nach vorne', () => {
    const route = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../lib/exile-leveling/__fixtures__/route-b7b2dd0.json'
        ),
        'utf8'
      )
    ) as RouteData.Route;

    for (let edge = 0; edge < route.edges.length; edge++) {
      expect(reanchorEdge(route.edges, route.edges[edge], edge)).toBe(edge);
    }
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

describe('actProgress', () => {
  const sections: RouteData.Section[] = [
    {
      name: 'Act 1',
      steps: [step(0, 'a'), step(null, 'hinweis'), step(1, 'b'), step(2, 'c')]
    },
    { name: 'Act 2', steps: [step(3, 'd'), step(4, 'e')] }
  ];

  it('nennt den Akt und was darin noch aussteht', () => {
    expect(actProgress(sections, 0)).toEqual({
      act: 'Act 1',
      stepsLeft: 2,
      stepsTotal: 3
    });
  });

  it('zaehlt Schritte ohne Zonenwechsel nicht mit', () => {
    expect(actProgress(sections, 2)?.stepsTotal).toBe(3);
    expect(actProgress(sections, 2)?.stepsLeft).toBe(0);
  });

  it('wechselt mit der Kante den Akt', () => {
    expect(actProgress(sections, 3)).toEqual({
      act: 'Act 2',
      stepsLeft: 1,
      stepsTotal: 2
    });
  });

  it('gibt null, wenn die Kante nirgends vorkommt', () => {
    expect(actProgress(sections, 99)).toBeNull();
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

    for (let edge = 0; edge < route.edges.length; edge++) {
      const progress = actProgress(route.sections, edge);
      expect(progress).not.toBeNull();
      expect(progress!.act).toMatch(/^Act \d+$/);
      expect(progress!.stepsLeft).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('selectPending', () => {
  const steps = [
    step(0, 'betrete A'),
    step(null, 'toete X'),
    step(null, 'gib Quest ab'),
    step(1, 'betrete B'),
    step(null, 'hole Waypoint')
  ];

  it('laesst den erledigten Uebergang weg und endet am naechsten', () => {
    expect(selectPending(steps, 0).map((s) => s.parts[0])).toEqual([
      'toete X',
      'gib Quest ab',
      'betrete B'
    ]);
  });

  it('zeigt nur noch den Rest der Zone, wenn kein Uebergang mehr folgt', () => {
    expect(selectPending(steps, 1).map((s) => s.parts[0])).toEqual([
      'hole Waypoint'
    ]);
  });

  it('haelt den letzten Schritt der Route fest, statt leer zu werden', () => {
    expect(selectPending([step(0, 'betrete A')], 0).map((s) => s.parts[0])).toEqual([
      'betrete A'
    ]);
  });

  it('gibt nichts zurueck, wenn die Kante nicht vorkommt', () => {
    expect(selectPending(steps, 99)).toEqual([]);
  });

  it('zeigt auf der echten Route nie den gerade erledigten Uebergang zuerst', () => {
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

    for (let edge = 0; edge < route.edges.length - 1; edge++) {
      const pending = selectPending(all, edge);
      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0]).not.toBe(all[all.findIndex((s) => s.edgeIndex === edge)]);
    }
  });
});

describe('groupSteps', () => {
  it('beginnt einen Block bei jedem Schritt mit eigener Kante', () => {
    const steps = [
      step(0, 'betrete A'),
      step(null, 'toete X'),
      step(1, 'betrete B'),
      step(null, 'hole Waypoint')
    ];

    expect(groupSteps(steps).map((group) => group.map((s) => s.parts[0]))).toEqual([
      ['betrete A', 'toete X'],
      ['betrete B', 'hole Waypoint']
    ]);
  });

  it('gibt einen Block je Kante, wenn keine Kante Zwischenschritte hat', () => {
    expect(groupSteps([step(0, 'a'), step(1, 'b')])).toHaveLength(2);
  });

  it('sammelt fuehrende Schritte ohne Kante in einem eigenen Block', () => {
    const groups = groupSteps([step(null, 'a'), step(null, 'b'), step(0, 'c')]);

    expect(groups.map((group) => group.map((s) => s.parts[0]))).toEqual([
      ['a', 'b'],
      ['c']
    ]);
  });

  it('kommt mit einer leeren Liste zurecht', () => {
    expect(groupSteps([])).toEqual([]);
  });

  it('teilt die echte Route lueckenlos in Bloecke', () => {
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
    const groups = groupSteps(all);

    // Kein Schritt geht verloren, keiner taucht doppelt auf.
    expect(groups.flat()).toEqual(all);
    // Genau ein Block je Kante, also genau ein Sprungziel je Block.
    expect(groups.filter((group) => group[0].edgeIndex !== null)).toHaveLength(
      route.edges.length
    );
  });
});
