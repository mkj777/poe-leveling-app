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
  it('nimmt den reinen Craftingschritt', () => {
    expect(isSkippable(step(['Get ', crafting]))).toBe(true);
  });

  it('nimmt den reinen Trialschritt', () => {
    expect(isSkippable(step(['Complete ', trial]))).toBe(true);
  });

  it('nimmt den Umweg, der nur zum Rezept fuehrt', () => {
    // Act 3: "Eternal Laboratory, get Crafting: Fire Damage - Rank 1". Das
    // Laboratory betritt man ausschliesslich fuer das Rezept.
    const arena: Fragments.ArenaFragment = {
      type: 'arena',
      value: 'Eternal Laboratory'
    };

    expect(isSkippable(step(['zu ', arena, ', get ', crafting]))).toBe(true);
  });

  it('nimmt den Trial, der einen Wegpunkt nur als Wegmarke nennt', () => {
    // Act 9: "Before waypoint, complete Trial of Ascendancy". Der Wegpunkt ist
    // dort keine Aufgabe, sondern die Ortsangabe fuer den Trial.
    const waypoint: Fragments.WaypointFragment = { type: 'waypoint' };

    expect(
      isSkippable(step(['Before ', waypoint, ', complete ', trial]))
    ).toBe(true);
  });

  it('nimmt auch eine Richtungsangabe mit', () => {
    const dir: Fragments.DirectionFragment = { type: 'dir', dirIndex: 2 };

    expect(isSkippable(step([dir, ' then get ', crafting]))).toBe(true);
  });

  it('laesst einen Schritt stehen, an dem noch eine Handlung haengt', () => {
    // Der wichtigste Fall fuer spaetere Routendaten: ein Boss darf nicht
    // verschwinden, nur weil im selben Satz ein Rezept steht.
    const kill: Fragments.KillFragment = { type: 'kill', value: 'Merveil' };

    expect(isSkippable(step(['Kill ', kill, ', get ', crafting]))).toBe(false);
  });

  it('laesst einen Schritt mit Kantenindex immer stehen', () => {
    // An ihm haengt der Fortschritt, siehe ADR-0004.
    expect(isSkippable(step(['Get ', crafting], { edgeIndex: 7 }))).toBe(false);
  });

  it('laesst Schritte ohne Crafting und Trial unberuehrt', () => {
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

  it('laesst die Route im Ligastart unangetastet', () => {
    expect(filterRoute(route, 'league-start')).toBe(route);
  });

  it('entfernt im Speedleveling Crafting und Trials', () => {
    expect(filterRoute(route, 'speedleveling').sections[0].steps).toHaveLength(
      2
    );
  });

  it('laesst die Kantenliste in Ruhe', () => {
    // Der Fortschritt zaehlt Kanten. Kein entfernter Schritt traegt eine, hier
    // darf sich also nichts bewegen.
    expect(filterRoute(route, 'speedleveling').edges).toEqual(route.edges);
  });

  it('raeumt auch unter einem Schritt auf, der bleibt', () => {
    const kept = filterRoute(route, 'speedleveling').sections[0]
      .steps[1] as RouteData.FragmentStep;

    expect(kept.subSteps).toHaveLength(1);
  });

  it('reicht einen unveraenderten Schritt unveraendert weiter', () => {
    expect(filterRoute(route, 'speedleveling').sections[0].steps[0]).toBe(
      route.sections[0].steps[0]
    );
  });

  it('laesst Gem-Schritte in Ruhe', () => {
    // Ohne PoB-Import gibt es keine (ADR-0007), der Typ laesst sie aber zu.
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
  it('fragt beim allerersten Start nicht', () => {
    expect(shouldOfferNewRun(null, Date.now())).toBe(false);
  });

  it('fragt genau ab der Grenze', () => {
    expect(shouldOfferNewRun(0, NEW_RUN_AFTER_MS)).toBe(true);
    expect(shouldOfferNewRun(0, NEW_RUN_AFTER_MS - 1)).toBe(false);
  });

  it('fragt nicht, wenn die Uhr zurueckgestellt wurde', () => {
    expect(shouldOfferNewRun(NEW_RUN_AFTER_MS * 2, 0)).toBe(false);
  });

  it('wartet elf Tage', () => {
    expect(NEW_RUN_AFTER_MS).toBe(11 * 24 * 60 * 60 * 1000);
  });
});

describe('PREPROCESSOR_DEFINITIONS', () => {
  it('schaltet LEAGUE_START nur im Ligastart ein', () => {
    expect(PREPROCESSOR_DEFINITIONS['league-start']).toContain('LEAGUE_START');
    expect(PREPROCESSOR_DEFINITIONS.speedleveling).not.toContain(
      'LEAGUE_START'
    );
  });

  it('laesst Bibliothek und Bandit in beiden Lesarten gleich', () => {
    for (const mode of ['league-start', 'speedleveling'] as const) {
      expect(PREPROCESSOR_DEFINITIONS[mode]).toContain('LIBRARY');
      expect(PREPROCESSOR_DEFINITIONS[mode]).toContain('BANDIT_ALIRA');
    }
  });
});

describe('an der echten Route', () => {
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

  it('trifft genau die 59 Schritte, um die es geht', () => {
    expect(steps.filter(isSkippable)).toHaveLength(59);
  });

  it('kennt nur vier Formen, in denen das vorkommt', () => {
    // Taucht eine fuenfte Form auf, hat der Upstream etwas Neues gebaut. Dann
    // gehoert die Regel angesehen, bevor sie darueber laeuft.
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

  it('fasst keinen Schritt an, der eine Kante traegt', () => {
    expect(
      steps.filter(isSkippable).every((candidate) => candidate.edgeIndex === null)
    ).toBe(true);
  });

  it('laesst kein Crafting und keinen Trial uebrig', () => {
    const rest = fragmentSteps(filterRoute(route, 'speedleveling'))
      .flatMap((candidate) => [candidate, ...candidate.subSteps])
      .flatMap(fragmentTypes);

    expect(rest).not.toContain('crafting');
    expect(rest).not.toContain('trial');
  });

  it('laesst die drei Labyrinthschritte stehen', () => {
    // Ascendancy-Punkte gelten je Charakter, nicht je Account, und die drei
    // Schritte tragen ausserdem eine Kante.
    const ascends = fragmentSteps(filterRoute(route, 'speedleveling')).filter(
      (candidate) => fragmentTypes(candidate).includes('ascend')
    );

    expect(ascends).toHaveLength(3);
  });

  it('hinterlaesst keinen leeren Block', () => {
    // Ein Block ohne Zeile waere ein Trenner ohne Inhalt und ein "Jump here"
    // ins Nichts.
    const blocks = blockSections(
      filterRoute(route, 'speedleveling').sections
    ).flatMap((section) => section.blocks);

    expect(blocks.every((block) => block.steps.length > 0)).toBe(true);

    // Je Kante ein Sprungziel, plus der Block vor der ersten Kante.
    expect(blocks).toHaveLength(route.edges.length + 1);
  });
});
