import { describe, expect, it } from 'vitest';

import type { RouteData } from '@/lib/exile-leveling';
import {
  actProgress,
  advanceEdge,
  flattenSteps,
  reanchorEdge,
  selectSegment
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

  it('selectSegment auf leerer Liste', () => {
    expect(selectSegment([], 0)).toEqual([]);
  });

  it('selectSegment, wenn keine Kante gesetzt ist', () => {
    expect(selectSegment([step(null, 'a'), step(null, 'b')], 0)).toEqual([]);
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

  it('selectSegment auf einem Index jenseits der Route', () => {
    expect(selectSegment([step(0, 'a')], 5)).toEqual([]);
  });

  it('actProgress auf einem Index jenseits der Route', () => {
    const sections: RouteData.Section[] = [
      { name: 'Act 1', steps: [step(0, 'a')] }
    ];

    expect(actProgress(sections, 5)).toBeNull();
  });
});

describe('Segmentgrenzen', () => {
  it('nimmt nur bis zur naechsten Kante, nicht darueber hinaus', () => {
    const steps = [step(0, 'a'), step(null, 'b'), step(1, 'c'), step(null, 'd')];

    expect(selectSegment(steps, 0).map((s) => s.parts[0])).toEqual(['a', 'b']);
  });

  it('gibt genau einen Schritt, wenn direkt die naechste Kante folgt', () => {
    const steps = [step(0, 'a'), step(1, 'b')];

    expect(selectSegment(steps, 0)).toHaveLength(1);
  });

  it('nimmt den ersten Treffer, wenn eine Kante doppelt vorkommt', () => {
    // Sollte in echten Routen nicht vorkommen, waere aber ein stiller
    // Fehlgriff statt eines Absturzes.
    const steps = [step(0, 'erste'), step(1, 'x'), step(0, 'zweite')];

    expect(selectSegment(steps, 0)[0].parts[0]).toBe('erste');
  });
});
