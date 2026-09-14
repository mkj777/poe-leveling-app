import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { Fragments, RouteData } from '@/lib/exile-leveling';
import {
  NEW_RUN_AFTER_MS,
  PREPROCESSOR_DEFINITIONS,
  filterRoute,
  isSkippable,
  shouldOfferNewRun
} from '../guide-mode';
import { blockSections } from '../route-progress';

function step(
  parts: Fragments.AnyFragment[],
  {
    edgeIndex = null,
    subSteps = []
  }: { edgeIndex?: number | null; subSteps?: RouteData.FragmentStep[] } = {}
): RouteData.FragmentStep {
  return { type: 'fragment_step', parts, subSteps, edgeIndex };
}

const crafting: Fragments.CraftingFragment = {
  type: 'crafting',
  crafting_recipes: ['Fire Damage - Rank 1']
};

const trial: Fragments.TrialFragment = { type: 'trial' };

function fragmentTypes(candidate: RouteData.FragmentStep): string[] {
  return candidate.parts
    .filter(
      (part): part is Exclude<Fragments.AnyFragment, string> =>
        typeof part !== 'string'
    )
    .map((part) => part.type);
}

describe('isSkippable', () => {
  it('takes the plain crafting step', () => {
    expect(isSkippable(step(['Get ', crafting]))).toBe(true);
  });

  it('takes the plain trial step', () => {
    expect(isSkippable(step(['Complete ', trial]))).toBe(true);
  });

  it('takes the detour that only leads to the recipe', () => {
    // Act 3: "Eternal Laboratory, get Crafting: Fire Damage - Rank 1". The
    // Laboratory is entered only for the recipe.
    const arena: Fragments.ArenaFragment = {
      type: 'arena',
      value: 'Eternal Laboratory'
    };

    expect(isSkippable(step(['to ', arena, ', get ', crafting]))).toBe(true);
  });

  it('takes the trial that names a waypoint only as a landmark', () => {
    // Act 9: "Before waypoint, complete Trial of Ascendancy". The waypoint is
    // not a task there but the location hint for the trial.
    const waypoint: Fragments.WaypointFragment = { type: 'waypoint' };

    expect(
      isSkippable(step(['Before ', waypoint, ', complete ', trial]))
    ).toBe(true);
  });

  it('takes a direction along too', () => {
    const dir: Fragments.DirectionFragment = { type: 'dir', dirIndex: 2 };

    expect(isSkippable(step([dir, ' then get ', crafting]))).toBe(true);
  });

  it('keeps a step that still has an action attached', () => {
    // The most important case for future route data: a boss must not
    // disappear just because a recipe stands in the same sentence.
    const kill: Fragments.KillFragment = { type: 'kill', value: 'Merveil' };

    expect(isSkippable(step(['Kill ', kill, ', get ', crafting]))).toBe(false);
  });

  it('always keeps a step with an edge index', () => {
    // Progress hangs on it, see ADR-0004.
    expect(isSkippable(step(['Get ', crafting], { edgeIndex: 7 }))).toBe(false);
  });

  it('leaves steps without crafting and trial untouched', () => {
    const enter: Fragments.EnterFragment = { type: 'enter', areaId: '1_1_2' };

    expect(isSkippable(step(['Go west']))).toBe(false);
    expect(isSkippable(step([enter]))).toBe(false);
  });
});

describe('filterRoute', () => {
  const enter: Fragments.EnterFragment = { type: 'enter', areaId: '1_1_2' };

  const route: RouteData.Route = {
    edges: ['1_1_1', '1_1_2'],
    sections: [
      {
        name: 'Act 1',
        steps: [
          step([enter], { edgeIndex: 1 }),
          step(['Get ', crafting]),
          step(['Complete ', trial]),
          step(['Kill something'], {
            subSteps: [step(['Go north']), step(['Get ', crafting])]
          })
        ]
      }
    ]
  };

  it('leaves the route untouched at league start', () => {
    expect(filterRoute(route, 'league-start')).toBe(route);
  });

  it('removes crafting and trials in speedleveling', () => {
    expect(filterRoute(route, 'speedleveling').sections[0].steps).toHaveLength(
      2
    );
  });

  it('leaves the edge list alone', () => {
    // Progress counts edges. No removed step carries one, so nothing may move
    // here.
    expect(filterRoute(route, 'speedleveling').edges).toEqual(route.edges);
  });

  it('cleans up below a step that stays too', () => {
    const kept = filterRoute(route, 'speedleveling').sections[0]
      .steps[1] as RouteData.FragmentStep;

    expect(kept.subSteps).toHaveLength(1);
  });

  it('passes an unchanged step through unchanged', () => {
    expect(filterRoute(route, 'speedleveling').sections[0].steps[0]).toBe(
      route.sections[0].steps[0]
    );
  });

  it('leaves gem steps alone', () => {
    // Without PoB import there are none (ADR-0007), but the type allows them.
    const gem: RouteData.GemStep = {
      type: 'gem_step',
      requiredGem: { id: 'x', note: '', count: 1 },
      rewardType: 'quest',
      count: 1
    };

    const withGem: RouteData.Route = {
      edges: [],
      sections: [{ name: 'Act 1', steps: [gem, step(['Get ', crafting])] }]
    };

    expect(filterRoute(withGem, 'speedleveling').sections[0].steps).toEqual([
      gem
    ]);
  });
});

describe('shouldOfferNewRun', () => {
  it('does not ask on the very first start', () => {
    expect(shouldOfferNewRun(null, Date.now())).toBe(false);
  });

  it('asks exactly from the threshold on', () => {
    expect(shouldOfferNewRun(0, NEW_RUN_AFTER_MS)).toBe(true);
    expect(shouldOfferNewRun(0, NEW_RUN_AFTER_MS - 1)).toBe(false);
  });

  it('does not ask when the clock was set back', () => {
    expect(shouldOfferNewRun(NEW_RUN_AFTER_MS * 2, 0)).toBe(false);
  });

  it('waits eleven days', () => {
    expect(NEW_RUN_AFTER_MS).toBe(11 * 24 * 60 * 60 * 1000);
  });
});

describe('PREPROCESSOR_DEFINITIONS', () => {
  it('enables LEAGUE_START only at league start', () => {
    expect(PREPROCESSOR_DEFINITIONS['league-start']).toContain('LEAGUE_START');
    expect(PREPROCESSOR_DEFINITIONS.speedleveling).not.toContain(
      'LEAGUE_START'
    );
  });

  it('keeps library and bandit the same in both modes', () => {
    for (const mode of ['league-start', 'speedleveling'] as const) {
      expect(PREPROCESSOR_DEFINITIONS[mode]).toContain('LIBRARY');
      expect(PREPROCESSOR_DEFINITIONS[mode]).toContain('BANDIT_ALIRA');
    }
  });
});

describe('on the real route', () => {
  const route: RouteData.Route = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '../../lib/exile-leveling/__fixtures__/route-b7b2dd0.json'
      ),
      'utf8'
    )
  );

  function fragmentSteps(source: RouteData.Route): RouteData.FragmentStep[] {
    return source.sections
      .flatMap((section) => section.steps)
      .filter(
        (candidate): candidate is RouteData.FragmentStep =>
          candidate.type === 'fragment_step'
      );
  }

  const steps = fragmentSteps(route);

  it('hits exactly the 59 steps in question', () => {
    expect(steps.filter(isSkippable)).toHaveLength(59);
  });

  it('knows only four shapes in which this occurs', () => {
    // If a fifth shape turns up, upstream has built something new. Then the
    // rule should be looked at before it runs over it.
    const forms = new Set(
      steps.filter(isSkippable).map((candidate) =>
        fragmentTypes(candidate).join('+')
      )
    );

    expect([...forms].sort()).toEqual([
      'arena+crafting',
      'crafting',
      'trial',
      'waypoint+trial'
    ]);
  });

  it('touches no step that carries an edge', () => {
    expect(
      steps.filter(isSkippable).every((candidate) => candidate.edgeIndex === null)
    ).toBe(true);
  });

  it('leaves no crafting and no trial behind', () => {
    const rest = fragmentSteps(filterRoute(route, 'speedleveling'))
      .flatMap((candidate) => [candidate, ...candidate.subSteps])
      .flatMap(fragmentTypes);

    expect(rest).not.toContain('crafting');
    expect(rest).not.toContain('trial');
  });

  it('keeps the three labyrinth steps', () => {
    // Ascendancy points are per character, not per account, and the three
    // steps carry an edge as well.
    const ascends = fragmentSteps(filterRoute(route, 'speedleveling')).filter(
      (candidate) => fragmentTypes(candidate).includes('ascend')
    );

    expect(ascends).toHaveLength(3);
  });

  it('leaves no empty block behind', () => {
    // A block without a line would be a separator without content and a
    // "Jump here" into nothing.
    const blocks = blockSections(
      filterRoute(route, 'speedleveling').sections
    ).flatMap((section) => section.blocks);

    expect(blocks.every((block) => block.steps.length > 0)).toBe(true);

    // One jump target per edge, plus the block before the first edge.
    expect(blocks).toHaveLength(route.edges.length + 1);
  });
});
