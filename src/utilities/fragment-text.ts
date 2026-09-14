import type { Fragments, RouteData } from '@/lib/exile-leveling';
import { Data } from '@/lib/exile-leveling';

// dirIndex is degrees divided by 45, so it runs 0 to 7 clockwise from north.
// See common/src/route-processing/fragment/index.ts.
//
// Spelled out instead of abbreviated: "Go SW follow the exits keeping W" reads
// as alphabet soup if you do not have the abbreviations in your head.
// Lower case, because the direction in the route always sits mid-sentence,
// never at the start: "Go west", "Usually northeast", "Follow the road
// southwest".
//
// Deliberately only here and not in free text. The route has exactly one spot
// with a single direction letter, "S shape or L shape leads to exit", and
// there the S means the shape of the path. A search over the running text
// would have turned it into "south shape".
const DIRECTIONS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest'
];

const LAB_NAMES: Record<Fragments.AscendFragment['version'], string> = {
  normal: 'Normal',
  cruel: 'Cruel',
  merciless: 'Merciless',
  eternal: 'Eternal'
};

function areaName(areaId: string): string {
  return Data.Areas[areaId]?.name ?? areaId;
}

export function renderFragment(fragment: Fragments.AnyFragment): string {
  if (typeof fragment === 'string') return fragment;

  switch (fragment.type) {
    case 'kill':
      return fragment.value;
    case 'arena':
      return fragment.value;
    case 'area':
      return areaName(fragment.areaId);
    case 'enter':
      return areaName(fragment.areaId);
    case 'logout':
      return `Logout to ${areaName(fragment.areaId)}`;
    case 'waypoint':
      return 'waypoint';
    case 'waypoint_get':
      return 'waypoint';
    case 'waypoint_use':
      return `Waypoint to ${areaName(fragment.dstAreaId)}`;
    case 'portal_set':
      return 'portal';
    case 'portal_use':
      return `Portal to ${areaName(fragment.dstAreaId)}`;
    case 'quest': {
      const quest = Data.Quests[fragment.questId];
      if (quest === undefined) return fragment.questId;

      const npc = fragment.rewardOffers
        .map((offerId) => quest.reward_offers[offerId]?.quest_npc)
        .find((name): name is string => typeof name === 'string');

      return npc === undefined ? quest.name : `${quest.name} (${npc})`;
    }
    case 'quest_text':
      return fragment.value;
    case 'generic':
      return fragment.value;
    case 'reward_quest':
      return fragment.item;
    case 'reward_vendor':
      return fragment.cost === undefined
        ? fragment.item
        : `${fragment.item} (${fragment.cost})`;
    case 'trial':
      return 'Trial of Ascendancy';
    case 'ascend':
      return `${LAB_NAMES[fragment.version]} Labyrinth`;
    case 'crafting':
      return `Crafting: ${fragment.crafting_recipes.join(', ')}`;
    case 'dir':
      return DIRECTIONS[fragment.dirIndex] ?? `${fragment.dirIndex * 45} degrees`;
    case 'copy':
      return fragment.text;
  }
}

export function renderStepText(step: RouteData.FragmentStep): string {
  return step.parts.map(renderFragment).join('');
}
