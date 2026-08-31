import { describe, expect, it } from 'vitest';

import type { RouteData } from '@/lib/exile-leveling';
import {
  actProgress,
  advanceEdge,
  flattenSteps,
  blockSections,
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

  it('blockSections auf leerer Liste', () => {
    expect(blockSections([{ name: 'Act 1', steps: [] }])[0].blocks).toEqual([]);
  });

  it('blockSections, wenn keine Kante gesetzt ist', () => {
    // Alles in einem Block, ohne Sprungziel: es gibt keine Kante, an der man
    // dabei staende.
    const blocks = blockSections([
      { name: 'Act 1', steps: [step(null, 'a'), step(null, 'b')] }
    ])[0].blocks;

    expect(blocks).toHaveLength(1);
    expect(blocks[0].edgeIndex).toBeNull();
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

  it('reanchorEdge auf leerer Kantenliste bleibt im gueltigen Bereich', () => {
    // Kommt in einer geparsten Route nicht vor, sie traegt immer mindestens
    // die Startkante. Der Rueckfall darf trotzdem kein Index sein, den es
    // nicht gibt.
    expect(reanchorEdge([], '1_1_1', 7)).toBe(0);
  });

  it('reanchorEdge klemmt auf eine kuerzer gewordene Kantenliste', () => {
    // Der Moduswechsel: vier Zonen gibt es nur im Ligastart, und dessen
    // Kantenliste ist die laengere.
    expect(reanchorEdge(['a', 'b', 'c'], 'weg', 99)).toBe(2);
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
  const nur = (steps: RouteData.FragmentStep[]) =>
    blockSections([{ name: 'Act 1', steps }])[0].blocks;

  it('endet mit dem Uebergang und nimmt nichts dahinter mit', () => {
    const steps = [step(0, 'a'), step(null, 'b'), step(1, 'c'), step(null, 'd')];

    expect(nur(steps)[1].steps.map((entry) => entry.parts[0])).toEqual([
      'b',
      'c'
    ]);
  });

  it('gibt einen Block je Kante, wenn direkt die naechste folgt', () => {
    expect(nur([step(0, 'a'), step(1, 'b')])).toEqual([
      { edgeIndex: null, steps: [step(0, 'a')] },
      { edgeIndex: 0, steps: [step(1, 'b')] }
    ]);
  });

  it('legt jede Kante in einen eigenen Block, auch bei doppeltem Index', () => {
    // Sollte in echten Routen nicht vorkommen. Beide bleiben sichtbar, statt
    // dass eine Suche still den ersten Treffer greift.
    const steps = [step(0, 'erste'), step(1, 'x'), step(0, 'zweite')];

    expect(nur(steps).map((block) => block.edgeIndex)).toEqual([null, 0, 1]);
  });
});
