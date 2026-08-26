import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { Fragments } from '@/lib/exile-leveling';
import { FRAGMENT_COLOURS, fragmentColour, fragmentIcon } from '../fragment-style';
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

const withIcon: Array<[string, Fragments.AnyFragment]> = [
  ['waypoint', { type: 'waypoint' }],
  ['waypoint_get', { type: 'waypoint_get' }],
  [
    'waypoint_use',
    { type: 'waypoint_use', dstAreaId: '1_1_2', srcAreaId: '1_1_town' }
  ],
  ['portal_set', { type: 'portal_set' }],
  ['portal_use', { type: 'portal_use', dstAreaId: '1_1_2' }],
  ['quest', { type: 'quest', questId: 'a1q1', rewardOffers: ['a1q1'] }],
  ['trial', { type: 'trial' }],
  ['ascend', { type: 'ascend', version: 'normal' }],
  ['crafting', { type: 'crafting', crafting_recipes: ['A'] }]
];

const withoutIcon: Array<[string, Fragments.AnyFragment]> = [
  ['string', 'nur Text'],
  ['kill', { type: 'kill', value: 'Hillock' }],
  ['arena', { type: 'arena', value: 'X' }],
  ['area', { type: 'area', areaId: '1_1_2' }],
  ['quest_text', { type: 'quest_text', value: 'Glyph' }],
  ['generic', { type: 'generic', value: 'Boat' }],
  ['reward_quest', { type: 'reward_quest', item: 'Iron Ring' }],
  ['reward_vendor', { type: 'reward_vendor', item: 'Iron Ring' }],
  ['dir', { type: 'dir', dirIndex: 0 }],
  ['copy', { type: 'copy', text: 'x', side: 'tail' }]
];

describe('fragmentIcon', () => {
  for (const [name, fragment] of withIcon) {
    it(`gibt ${name} ein Symbol`, () => {
      expect(fragmentIcon(fragment)).toBeTruthy();
    });
  }

  for (const [name, fragment] of withoutIcon) {
    it(`gibt ${name} keins`, () => {
      expect(fragmentIcon(fragment)).toBeNull();
    });
  }

  it('traegt das Stadtsymbol nur bei echten Staedten', () => {
    // Lioneye's Watch ist eine Stadt, The Coast nicht. Ohne die Unterscheidung
    // haetten alle Zonen dasselbe Symbol.
    expect(fragmentIcon({ type: 'enter', areaId: '1_1_town' })).toBeTruthy();
    expect(fragmentIcon({ type: 'enter', areaId: '1_1_2' })).toBeNull();
  });

  it('gilt fuer logout genauso wie fuer enter', () => {
    expect(fragmentIcon({ type: 'logout', areaId: '1_1_town' })).toBeTruthy();
  });
});

describe('fragmentColour', () => {
  const cases: Array<[Fragments.AnyFragment, keyof typeof FRAGMENT_COLOURS]> = [
    ['text', 'plain'],
    [{ type: 'kill', value: 'x' }, 'enemy'],
    [{ type: 'arena', value: 'x' }, 'area'],
    [{ type: 'area', areaId: '1_1_2' }, 'area'],
    [{ type: 'enter', areaId: '1_1_2' }, 'area'],
    [{ type: 'logout', areaId: '1_1_town' }, 'area'],
    [{ type: 'quest', questId: 'a1q1', rewardOffers: [] }, 'quest'],
    [{ type: 'reward_quest', item: 'x' }, 'quest'],
    [{ type: 'reward_vendor', item: 'x' }, 'quest'],
    [{ type: 'quest_text', value: 'x' }, 'questText'],
    [{ type: 'waypoint' }, 'waypoint'],
    [{ type: 'waypoint_get' }, 'waypoint'],
    [
      { type: 'waypoint_use', dstAreaId: '1_1_2', srcAreaId: '1_1_town' },
      'waypoint'
    ],
    [{ type: 'portal_set' }, 'portal'],
    [{ type: 'portal_use', dstAreaId: '1_1_2' }, 'portal'],
    [{ type: 'trial' }, 'trial'],
    [{ type: 'ascend', version: 'cruel' }, 'trial'],
    [{ type: 'crafting', crafting_recipes: [] }, 'crafting'],
    [{ type: 'generic', value: 'x' }, 'plain'],
    [{ type: 'dir', dirIndex: 0 }, 'plain'],
    [{ type: 'copy', text: 'x', side: 'head' }, 'plain']
  ];

  for (const [fragment, expected] of cases) {
    const name = typeof fragment === 'string' ? 'string' : fragment.type;
    it(`ordnet ${name} der Farbe ${expected} zu`, () => {
      expect(fragmentColour(fragment)).toBe(expected);
      expect(FRAGMENT_COLOURS[expected]).toBeDefined();
    });
  }
});
