import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { Fragments, RouteData } from '@/lib/exile-leveling';
import { fragmentColour, fragmentIcon } from '../fragment-style';
import { renderFragment, renderStepText } from '../fragment-text';
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

describe('missing game data', () => {
  it('falls back to the id for an unknown zone', () => {
    expect(renderFragment({ type: 'enter', areaId: 'does_not_exist' })).toBe(
      'does_not_exist'
    );
  });

  it('falls back to the id for an unknown quest', () => {
    expect(
      renderFragment({ type: 'quest', questId: 'a99q9', rewardOffers: [] })
    ).toBe('a99q9');
  });

  it('names the quest without NPC when no offer matches', () => {
    // The name is in quests.json, the offer is not. This used to write
    // undefined into the text.
    const text = renderFragment({
      type: 'quest',
      questId: 'a1q1',
      rewardOffers: ['does_not_exist']
    });

    expect(text).toBe('Enemy at the Gate');
    expect(text).not.toContain('undefined');
  });

  it('takes the first offer that names an NPC', () => {
    expect(
      renderFragment({
        type: 'quest',
        questId: 'a1q1',
        rewardOffers: ['does_not_exist', 'a1q1']
      })
    ).toBe('Enemy at the Gate (Tarkleigh)');
  });

  it('knows no town icon for an unknown zone', () => {
    expect(fragmentIcon({ type: 'enter', areaId: 'does_not_exist' })).toBeNull();
  });
});

describe('directions outside the table', () => {
  it('names the degrees for an unknown index instead of undefined', () => {
    expect(renderFragment({ type: 'dir', dirIndex: 8 })).toBe('360 degrees');
    expect(renderFragment({ type: 'dir', dirIndex: 12 })).toBe('540 degrees');
  });

  it('covers all eight valid directions', () => {
    const names = Array.from({ length: 8 }, (_v, i) =>
      renderFragment({ type: 'dir', dirIndex: i })
    );

    expect(names).toEqual([
      'north',
      'northeast',
      'east',
      'southeast',
      'south',
      'southwest',
      'west',
      'northwest'
    ]);
    expect(new Set(names).size).toBe(8);
  });

  it('writes lower case because the direction always sits mid-sentence', () => {
    const names = Array.from({ length: 8 }, (_v, i) =>
      renderFragment({ type: 'dir', dirIndex: i })
    );

    for (const name of names) expect(name).toBe(name.toLowerCase());
  });
});

describe('abbreviations only in the direction fragment', () => {
  it('leaves single letters in free text alone', () => {
    // The real route has exactly one such case, and there the S means the
    // shape of the path, not south. Free text is therefore not touched.
    expect(renderFragment('S shape or L shape leads to exit')).toBe(
      'S shape or L shape leads to exit'
    );

    expect(
      renderFragment({
        type: 'quest_text',
        value: 'Look for the NE corner'
      })
    ).toBe('Look for the NE corner');
  });
});

describe('empty and unusual contents', () => {
  it('crafting without recipes stays readable', () => {
    expect(renderFragment({ type: 'crafting', crafting_recipes: [] })).toBe(
      'Crafting: '
    );
  });

  it('crafting with several recipes lists them', () => {
    expect(
      renderFragment({ type: 'crafting', crafting_recipes: ['A', 'B'] })
    ).toBe('Crafting: A, B');
  });

  it('reward_vendor without a price names only the item', () => {
    expect(renderFragment({ type: 'reward_vendor', item: 'Iron Ring' })).toBe(
      'Iron Ring'
    );
  });

  it('an empty string stays an empty string', () => {
    expect(renderFragment('')).toBe('');
  });

  it('renderStepText on a step without parts', () => {
    const empty: RouteData.FragmentStep = {
      type: 'fragment_step',
      parts: [],
      subSteps: [],
      edgeIndex: null
    };

    expect(renderStepText(empty)).toBe('');
  });
});

describe('against the real route', () => {
  const route = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '../../lib/exile-leveling/__fixtures__/route-b7b2dd0.json'
      ),
      'utf8'
    )
  ) as RouteData.Route;

  function allFragments(): Fragments.AnyFragment[] {
    const out: Fragments.AnyFragment[] = [];
    for (const section of route.sections) {
      for (const step of section.steps) {
        if (step.type !== 'fragment_step') continue;
        out.push(...step.parts);
        for (const sub of step.subSteps) out.push(...sub.parts);
      }
    }
    return out;
  }

  it('renders every fragment of the route without a gap', () => {
    for (const fragment of allFragments()) {
      const text = renderFragment(fragment);

      expect(typeof text).toBe('string');
      expect(text).not.toContain('undefined');
      expect(text).not.toContain('NOT FOUND');
      expect(text).not.toContain('[object');
    }
  });

  it('gives every fragment a valid colour', () => {
    for (const fragment of allFragments()) {
      expect(typeof fragmentColour(fragment)).toBe('string');
    }
  });

  it('no step of the route renders to an empty text', () => {
    for (const section of route.sections) {
      for (const step of section.steps) {
        if (step.type !== 'fragment_step') continue;
        expect(renderStepText(step).trim().length).toBeGreaterThan(0);
      }
    }
  });
});
