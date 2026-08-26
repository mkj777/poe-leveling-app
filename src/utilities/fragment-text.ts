import type { Fragments, RouteData } from '@/lib/exile-leveling';
import { Data } from '@/lib/exile-leveling';

// dirIndex ist Grad geteilt durch 45, laeuft also 0 bis 7 im Uhrzeigersinn ab
// Norden. Siehe common/src/route-processing/fragment/index.ts.
//
// Ausgeschrieben statt abgekuerzt: "Go SW follow the exits keeping W" liest
// sich als Buchstabensalat, wenn man die Kuerzel nicht im Kopf hat.
// Kleingeschrieben, weil die Richtung in der Route immer mitten im Satz steht,
// nie am Anfang: "Go west", "Usually northeast", "Follow the road southwest".
//
// Bewusst nur hier und nicht im Freitext. In der Route steht genau eine Stelle
// mit einem einzelnen Richtungsbuchstaben, "S shape or L shape leads to exit",
// und dort meint das S die Form des Weges. Eine Suche ueber den Fliesstext
// haette daraus "south shape" gemacht.
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
      return DIRECTIONS[fragment.dirIndex] ?? `${fragment.dirIndex * 45} Grad`;
    case 'copy':
      return fragment.text;
  }
}

export function renderStepText(step: RouteData.FragmentStep): string {
  return step.parts.map(renderFragment).join('');
}
