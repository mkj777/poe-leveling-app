import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { RouteData } from '@/lib/exile-leveling';
import {
  actProgress,
  advanceEdge,
  blockSections,
  flattenSteps,
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
  it('advances when the next edge matches', () => {
    expect(advanceEdge(EDGES, 0, '1_1_town')).toBe(1);
  });

  it('stays put when the zone is not the next edge', () => {
    expect(advanceEdge(EDGES, 0, '1_1_3')).toBe(0);
  });

  it('does not jump back on a repeated zone', () => {
    expect(advanceEdge(EDGES, 2, '1_1_town')).toBe(3);
    expect(advanceEdge(EDGES, 3, '1_1_town')).toBe(3);
  });

  it('does not overflow at the end', () => {
    expect(advanceEdge(EDGES, 4, '1_1_3')).toBe(4);
  });
});

describe('reanchorEdge', () => {
  it('keeps the stored index when it still fits', () => {
    // The normal case on restart: the data is unchanged, the index still
    // points at the same zone. It used to jump to the last occurrence of the
    // zone here anyway, right into the middle of the act.
    expect(reanchorEdge(EDGES, '1_1_town', 1)).toBe(1);
    expect(reanchorEdge(EDGES, '1_1_town', 3)).toBe(3);
  });

  it('takes the nearest occurrence, not the last', () => {
    // Only when the stored index no longer fits is there a search. Then the
    // nearby occurrence is meant, not the one at the end of the act.
    expect(reanchorEdge(EDGES, '1_1_town', 0)).toBe(1);
    expect(reanchorEdge(EDGES, '1_1_town', 4)).toBe(3);
  });

  it('prefers the earlier occurrence on a tie', () => {
    // Standing too far ahead costs a glance, standing too far behind skips
    // steps.
    expect(reanchorEdge(EDGES, '1_1_town', 2)).toBe(1);
  });

  it('uses the fallback when the zone is unknown', () => {
    expect(reanchorEdge(EDGES, '9_9_9', 2)).toBe(2);
  });

  it('keeps progress in a zone the act visits several times', () => {
    const route = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../lib/exile-leveling/__fixtures__/route-b7b2dd0.json'
        ),
        'utf8'
      )
    ) as RouteData.Route;

    // The Forest Encampment sits on edges 135, 137, 145, 150 and 156. Each
    // of them must find itself again.
    for (const edge of [135, 137, 145, 150, 156]) {
      expect(route.edges[edge]).toBe('2_6_town');
      expect(reanchorEdge(route.edges, '2_6_town', edge)).toBe(edge);
    }
  });

  it('falls forward on no edge of the real route', () => {
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
  it('pulls the steps of all sections together', () => {
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
      steps: [step(0, 'a'), step(null, 'hint'), step(1, 'b'), step(2, 'c')]
    },
    { name: 'Act 2', steps: [step(3, 'd'), step(4, 'e')] }
  ];

  it('names the act and what is still pending in it', () => {
    expect(actProgress(sections, 0)).toEqual({
      act: 'Act 1',
      stepsLeft: 2,
      stepsTotal: 3
    });
  });

  it('does not count steps without a zone change', () => {
    expect(actProgress(sections, 2)?.stepsTotal).toBe(3);
    expect(actProgress(sections, 2)?.stepsLeft).toBe(0);
  });

  it('changes the act with the edge', () => {
    expect(actProgress(sections, 3)).toEqual({
      act: 'Act 2',
      stepsLeft: 1,
      stepsTotal: 2
    });
  });

  it('returns null when the edge occurs nowhere', () => {
    expect(actProgress(sections, 99)).toBeNull();
  });

  it('covers every edge of the real route', () => {
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
    step(0, 'enter A'),
    step(null, 'kill X'),
    step(null, 'turn in quest'),
    step(1, 'enter B'),
    step(null, 'get waypoint')
  ];

  it('drops the completed transition and ends at the next one', () => {
    expect(selectPending(steps, 0).map((s) => s.parts[0])).toEqual([
      'kill X',
      'turn in quest',
      'enter B'
    ]);
  });

  it('shows only the rest of the zone when no transition follows', () => {
    expect(selectPending(steps, 1).map((s) => s.parts[0])).toEqual([
      'get waypoint'
    ]);
  });

  it('holds on to the last step of the route instead of going empty', () => {
    expect(selectPending([step(0, 'enter A')], 0).map((s) => s.parts[0])).toEqual([
      'enter A'
    ]);
  });

  it('returns nothing when the edge does not occur', () => {
    expect(selectPending(steps, 99)).toEqual([]);
  });

  it('never shows the transition just made first on the real route', () => {
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
describe('blockSections', () => {
  const section = (name: string, steps: RouteData.Step[]) => ({ name, steps });

  it('ends a block with the transition instead of starting it with one', () => {
    // The transition is done as soon as Client.txt reports the zone. It
    // belongs at the end of what is done before it, not at the start of what
    // comes after.
    const steps = [
      step(0, 'enter A'),
      step(null, 'kill X'),
      step(1, 'enter B'),
      step(null, 'get waypoint')
    ];

    expect(
      blockSections([section('Act 1', steps)])[0].blocks.map((block) => ({
        edgeIndex: block.edgeIndex,
        texts: block.steps.map((entry) => entry.parts[0])
      }))
    ).toEqual([
      { edgeIndex: null, texts: ['enter A'] },
      { edgeIndex: 0, texts: ['kill X', 'enter B'] },
      { edgeIndex: 1, texts: ['get waypoint'] }
    ]);
  });

  it('names the edge one is standing at', () => {
    // Not the one the last step leads into: standing at edge 0 one does what
    // is to be done until entering edge 1.
    const blocks = blockSections([
      section('Act 1', [step(0, 'a'), step(null, 'b'), step(1, 'c')])
    ])[0].blocks;

    expect(blocks[1].edgeIndex).toBe(0);
    expect(blocks[1].steps.map((entry) => entry.parts[0])).toEqual(['b', 'c']);
  });

  it('lets a block run across the act boundary, in the act it starts in', () => {
    const sections = blockSections([
      section('Act 1', [step(0, 'enter A'), step(null, 'clean up')]),
      section('Act 2', [step(1, 'enter B')])
    ]);

    expect(
      sections[0].blocks.map((block) => block.steps.map((e) => e.parts[0]))
    ).toEqual([['enter A'], ['clean up', 'enter B']]);
    expect(sections[1].blocks).toEqual([]);
  });

  it('handles an empty route', () => {
    expect(blockSections([])).toEqual([]);
    expect(blockSections([section('Act 1', [])])).toEqual([
      { name: 'Act 1', blocks: [] }
    ]);
  });

  it('leaves gem steps out', () => {
    const gem: RouteData.GemStep = {
      type: 'gem_step',
      requiredGem: { id: 'x', note: '', count: 1 },
      rewardType: 'quest',
      count: 1
    };

    const blocks = blockSections([section('Act 1', [gem, step(0, 'a')])])[0]
      .blocks;

    expect(blocks).toEqual([{ edgeIndex: null, steps: [step(0, 'a')] }]);
  });

  it('splits the real route into blocks without gaps', () => {
    const route = realRoute();
    const all = flattenSteps(route.sections);

    const blocks = blockSections(route.sections).flatMap(
      (entry) => entry.blocks
    );

    // No step gets lost, none shows up twice.
    expect(blocks.flatMap((block) => block.steps)).toEqual(all);
  });

  it('highlights exactly what the overlay shows', () => {
    // The actual point. For every edge both must yield the same sequence,
    // otherwise the list shows a different step than the overlay. Before, it
    // was off by one step: at edge 53 the list said "➞ The Slums" and the
    // overlay "➞ The Crematorium".
    const route = realRoute();
    const all = flattenSteps(route.sections);

    const blocks = blockSections(route.sections).flatMap(
      (entry) => entry.blocks
    );

    for (let edge = 0; edge < route.edges.length; edge++) {
      const block = blocks.find((entry) => entry.edgeIndex === edge);

      expect(block, `edge ${edge} has no block`).toBeDefined();
      expect(block!.steps, `edge ${edge}`).toEqual(selectPending(all, edge));
    }
  });
});

function realRoute(): RouteData.Route {
  return JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '../../lib/exile-leveling/__fixtures__/route-b7b2dd0.json'
      ),
      'utf8'
    )
  ) as RouteData.Route;
}
