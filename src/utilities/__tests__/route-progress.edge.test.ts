import { describe, expect, it } from 'vitest';

import type { RouteData } from '@/lib/exile-leveling';
import {
  actProgress,
  advanceEdge,
  flattenSteps,
  groupSteps,
  reanchorEdge
} from '../route-progress';

function step(edgeIndex: number | null, text: string): RouteData.FragmentStep {
  return { type: 'fragment_step', parts: [text], subSteps: [], edgeIndex };
}

const gemStep = {
  type: 'gem_step',
  requiredGem: { id: 'x', note: '', count: 1 },
  rewardType: 'quest',
  count: 1
} as unknown as RouteData.Step;

describe('leere und entartete Routen', () => {
  it('flattenSteps auf keiner Sektion', () => {
    expect(flattenSteps([])).toEqual([]);
  });

  it('flattenSteps auf Sektionen ohne Schritte', () => {
    expect(flattenSteps([{ name: 'Act 1', steps: [] }])).toEqual([]);
  });

  it('flattenSteps laesst Gem-Schritte draussen', () => {
    const sections: RouteData.Section[] = [
      { name: 'Act 1', steps: [gemStep, step(0, 'a'), gemStep] }
    ];

    expect(flattenSteps(sections)).toHaveLength(1);
  });

  it('groupSteps auf leerer Liste', () => {
    expect(groupSteps([])).toEqual([]);
  });

  it('groupSteps, wenn keine Kante gesetzt ist', () => {
    expect(groupSteps([step(null, 'a'), step(null, 'b')])).toHaveLength(1);
  });

  it('actProgress auf keiner Sektion', () => {
    expect(actProgress([], 0)).toBeNull();
  });

  it('actProgress auf einer Sektion ganz ohne Kanten', () => {
    const sections: RouteData.Section[] = [
      { name: 'Act 1', steps: [step(null, 'a')] }
    ];

    expect(actProgress(sections, 0)).toBeNull();
  });
});

describe('Grenzen des Kantenindex', () => {
  const edges = ['1_1_1', '1_1_town', '1_1_2'];

  it('advanceEdge am letzten Index laeuft nicht ueber', () => {
    expect(advanceEdge(edges, edges.length - 1, '1_1_2')).toBe(2);
  });

  it('advanceEdge auf leerer Kantenliste', () => {
    expect(advanceEdge([], 0, '1_1_1')).toBe(0);
  });

  it('advanceEdge ignoriert einen leeren Zonennamen', () => {
    expect(advanceEdge(edges, 0, '')).toBe(0);
  });

  it('reanchorEdge auf leerer Kantenliste nimmt den Rueckfall', () => {
    expect(reanchorEdge([], '1_1_1', 7)).toBe(7);
  });

  it('reanchorEdge trifft den ersten Index, wenn die Zone dort steht', () => {
    expect(reanchorEdge(edges, '1_1_1', 99)).toBe(0);
  });

  it('actProgress auf einem Index jenseits der Route', () => {
    const sections: RouteData.Section[] = [
      { name: 'Act 1', steps: [step(0, 'a')] }
    ];

    expect(actProgress(sections, 5)).toBeNull();
  });
});

describe('Blockgrenzen', () => {
  it('schneidet an der naechsten Kante ab, nicht darueber hinaus', () => {
    const steps = [step(0, 'a'), step(null, 'b'), step(1, 'c'), step(null, 'd')];

    expect(groupSteps(steps)[0].map((s) => s.parts[0])).toEqual(['a', 'b']);
  });

  it('gibt einen Block je Kante, wenn direkt die naechste folgt', () => {
    expect(groupSteps([step(0, 'a'), step(1, 'b')])).toEqual([
      [step(0, 'a')],
      [step(1, 'b')]
    ]);
  });

  it('legt jede Kante in einen eigenen Block, auch bei doppeltem Index', () => {
    // Sollte in echten Routen nicht vorkommen. Frueher griff die Suche hier
    // still den ersten Treffer, jetzt bleiben beide sichtbar.
    const steps = [step(0, 'erste'), step(1, 'x'), step(0, 'zweite')];

    expect(groupSteps(steps).map((g) => g[0].parts[0])).toEqual([
      'erste',
      'x',
      'zweite'
    ]);
  });
});
