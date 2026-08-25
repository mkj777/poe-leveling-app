import type { Fragments, RouteData } from '@/lib/exile-leveling';
import { Data } from '@/lib/exile-leveling';

// dirIndex ist Grad geteilt durch 45, laeuft also 0 bis 7 im Uhrzeigersinn ab
// Norden. Siehe common/src/route-processing/fragment/index.ts.
const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

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
      return DIRECTIONS[fragment.dirIndex] ?? `${fragment.dirIndex * 45} Grad`;
    case 'copy':
      return fragment.text;
  }
}

export function renderStepText(step: RouteData.FragmentStep): string {
  return step.parts.map(renderFragment).join('');
}
