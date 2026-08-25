import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import type { Fragments } from '@/lib/exile-leveling';
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

// Ein Fall je Variante der Fragment-Union. Faellt eine Variante raus, faengt
// das der Vollstaendigkeitstest weiter unten.
const cases: Array<[string, Fragments.AnyFragment, string]> = [
  ['string', 'Find and kill ', 'Find and kill '],
  ['kill', { type: 'kill', value: 'Hillock' }, 'Hillock'],
  ['arena', { type: 'arena', value: "Merveil's Lair" }, "Merveil's Lair"],
  ['area', { type: 'area', areaId: '1_1_2' }, 'The Coast'],
  ['enter', { type: 'enter', areaId: '1_1_2' }, 'The Coast'],
  [
    'logout',
    { type: 'logout', areaId: '1_1_town' },
    "Logout to Lioneye's Watch"
  ],
  ['waypoint', { type: 'waypoint' }, 'waypoint'],
  ['waypoint_get', { type: 'waypoint_get' }, 'waypoint'],
  [
    'waypoint_use',
    { type: 'waypoint_use', dstAreaId: '1_1_2', srcAreaId: '1_1_4_1' },
    'Waypoint to The Coast'
  ],
  ['portal_set', { type: 'portal_set' }, 'portal'],
  [
    'portal_use',
    { type: 'portal_use', dstAreaId: '1_1_4_1' },
    'Portal to The Submerged Passage'
  ],
  [
    'quest',
    { type: 'quest', questId: 'a1q1', rewardOffers: ['a1q1'] },
    'Enemy at the Gate (Tarkleigh)'
  ],
  ['quest_text', { type: 'quest_text', value: 'Glyph' }, 'Glyph'],
  ['generic', { type: 'generic', value: 'Boat' }, 'Boat'],
  ['reward_quest', { type: 'reward_quest', item: 'Iron Ring' }, 'Iron Ring'],
  [
    'reward_vendor',
    { type: 'reward_vendor', item: 'Iron Ring', cost: '1x Orb' },
    'Iron Ring (1x Orb)'
  ],
  ['trial', { type: 'trial' }, 'Trial of Ascendancy'],
  ['ascend', { type: 'ascend', version: 'normal' }, 'Normal Labyrinth'],
  [
    'crafting',
    { type: 'crafting', crafting_recipes: ['Movement Speed - Rank 1'] },
    'Crafting: Movement Speed - Rank 1'
  ],
  ['dir 0', { type: 'dir', dirIndex: 0 }, 'N'],
  ['dir 6', { type: 'dir', dirIndex: 6 }, 'W'],
  ['dir 7', { type: 'dir', dirIndex: 7 }, 'NW'],
  ['copy', { type: 'copy', text: '"Fireball"', side: 'tail' }, '"Fireball"']
];

describe('renderFragment', () => {
  for (const [name, fragment, expected] of cases) {
    it(`rendert ${name}`, () => {
      expect(renderFragment(fragment)).toBe(expected);
    });
  }

  it('erzeugt nirgends NOT FOUND', () => {
    for (const [, fragment] of cases) {
      expect(renderFragment(fragment)).not.toContain('NOT FOUND');
    }
  });

  it('deckt jede Variante der Union ab', () => {
    const covered = new Set(
      cases
        .map(([, fragment]) => fragment)
        .filter((fragment) => typeof fragment !== 'string')
        .map((fragment) => (fragment as { type: string }).type)
    );

    const expectedTypes = [
      'kill',
      'arena',
      'area',
      'enter',
      'logout',
      'waypoint',
      'waypoint_get',
      'waypoint_use',
      'portal_set',
      'portal_use',
      'quest',
      'quest_text',
      'generic',
      'reward_quest',
      'reward_vendor',
      'trial',
      'ascend',
      'crafting',
      'dir',
      'copy'
    ];

    expect([...covered].sort()).toEqual([...expectedTypes].sort());
  });
});

describe('renderStepText', () => {
  it('setzt die Teile eines Schritts zusammen', () => {
    const text = renderStepText({
      type: 'fragment_step',
      parts: ['Find and kill ', { type: 'kill', value: 'Hillock' }],
      subSteps: [],
      edgeIndex: 0
    });

    expect(text).toBe('Find and kill Hillock');
  });
});
