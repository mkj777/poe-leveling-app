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

describe('empty and degenerate routes', () => {
  it('flattenSteps on no section', () => {
    expect(flattenSteps([])).toEqual([]);
  });

  it('flattenSteps on sections without steps', () => {
    expect(flattenSteps([{ name: 'Act 1', steps: [] }])).toEqual([]);
  });

  it('flattenSteps leaves gem steps out', () => {
    const sections: RouteData.Section[] = [
      { name: 'Act 1', steps: [gemStep, step(0, 'a'), gemStep] }
    ];

    expect(flattenSteps(sections)).toHaveLength(1);
  });

  it('blockSections on an empty list', () => {
    expect(blockSections([{ name: 'Act 1', steps: [] }])[0].blocks).toEqual([]);
  });

  it('blockSections when no edge is set', () => {
    // Everything in one block, without a jump target: there is no edge one
    // would be standing at.
    const blocks = blockSections([
      { name: 'Act 1', steps: [step(null, 'a'), step(null, 'b')] }
    ])[0].blocks;

    expect(blocks).toHaveLength(1);
    expect(blocks[0].edgeIndex).toBeNull();
  });

  it('actProgress on no section', () => {
    expect(actProgress([], 0)).toBeNull();
  });

  it('actProgress on a section without any edges', () => {
    const sections: RouteData.Section[] = [
      { name: 'Act 1', steps: [step(null, 'a')] }
    ];

    expect(actProgress(sections, 0)).toBeNull();
  });
});

describe('limits of the edge index', () => {
  const edges = ['1_1_1', '1_1_town', '1_1_2'];

  it('advanceEdge at the last index does not overflow', () => {
    expect(advanceEdge(edges, edges.length - 1, '1_1_2')).toBe(2);
  });

  it('advanceEdge on an empty edge list', () => {
    expect(advanceEdge([], 0, '1_1_1')).toBe(0);
  });

  it('advanceEdge ignores an empty zone name', () => {
    expect(advanceEdge(edges, 0, '')).toBe(0);
  });

  it('reanchorEdge on an empty edge list stays in the valid range', () => {
    // Does not occur in a parsed route, which always carries at least the
    // start edge. The fallback must still not be an index that does not
    // exist.
    expect(reanchorEdge([], '1_1_1', 7)).toBe(0);
  });

  it('reanchorEdge clamps to an edge list that got shorter', () => {
    // The mode switch: four zones exist only at league start, and its edge
    // list is the longer one.
    expect(reanchorEdge(['a', 'b', 'c'], 'gone', 99)).toBe(2);
  });

  it('reanchorEdge hits the first index when the zone is there', () => {
    expect(reanchorEdge(edges, '1_1_1', 99)).toBe(0);
  });

  it('actProgress on an index beyond the route', () => {
    const sections: RouteData.Section[] = [
      { name: 'Act 1', steps: [step(0, 'a')] }
    ];

    expect(actProgress(sections, 5)).toBeNull();
  });
});

describe('block boundaries', () => {
  const only = (steps: RouteData.FragmentStep[]) =>
    blockSections([{ name: 'Act 1', steps }])[0].blocks;

  it('ends with the transition and takes nothing after it', () => {
    const steps = [step(0, 'a'), step(null, 'b'), step(1, 'c'), step(null, 'd')];

    expect(only(steps)[1].steps.map((entry) => entry.parts[0])).toEqual([
      'b',
      'c'
    ]);
  });

  it('gives one block per edge when the next follows directly', () => {
    expect(only([step(0, 'a'), step(1, 'b')])).toEqual([
      { edgeIndex: null, steps: [step(0, 'a')] },
      { edgeIndex: 0, steps: [step(1, 'b')] }
    ]);
  });

  it('puts every edge into its own block, even with a duplicate index', () => {
    // Should not occur in real routes. Both stay visible instead of a search
    // silently grabbing the first hit.
    const steps = [step(0, 'first'), step(1, 'x'), step(0, 'second')];

    expect(only(steps).map((block) => block.edgeIndex)).toEqual([null, 0, 1]);
  });
});
