import type { Fragments } from '@/lib/exile-leveling';

import { Data } from '@/lib/exile-leveling';
import crafting from '@/assets/exile-leveling/crafting.png';
import portal from '@/assets/exile-leveling/portal.png';
import quest from '@/assets/exile-leveling/quest.png';
import town from '@/assets/exile-leveling/town.png';
import trial from '@/assets/exile-leveling/trial.png';
import waypoint from '@/assets/exile-leveling/waypoint.png';

/**
 * Colours and icons as in the original, see
 * web/src/components/FragmentStep/Fragment/styles.module.css in the upstream
 * project. Anyone who read the guide there should see the same here.
 */
export const FRAGMENT_COLOURS = {
  enemy: 'text-[darkorange]',
  area: 'text-[#ffcf91]',
  quest: 'text-[gold]',
  questText: 'text-[lime]',
  waypoint: 'text-[#8ab3ff]',
  portal: 'text-[#8ab3ff]',
  trial: 'text-[darkseagreen]',
  crafting: 'text-[darkseagreen]',
  plain: ''
} as const;

export type FragmentColour = keyof typeof FRAGMENT_COLOURS;

/**
 * Icons are referred to by name, not by address inside the bundle. The
 * overlay gets its lines sent as data (ADR-0012), and an address like
 * `/assets/quest-BQCG-isT.png` has no business there: it belongs to the
 * build, not to the content.
 */
export type IconName =
  | 'waypoint'
  | 'portal'
  | 'quest'
  | 'trial'
  | 'crafting'
  | 'town';

export const ICON_SOURCES: Record<IconName, string> = {
  waypoint,
  portal,
  quest,
  trial,
  crafting,
  town
};

export function fragmentColour(fragment: Fragments.AnyFragment): FragmentColour {
  if (typeof fragment === 'string') return 'plain';

  switch (fragment.type) {
    case 'kill':
      return 'enemy';
    case 'arena':
    case 'area':
    case 'enter':
    case 'logout':
      return 'area';
    case 'quest':
    case 'reward_quest':
    case 'reward_vendor':
      return 'quest';
    case 'quest_text':
      return 'questText';
    case 'waypoint':
    case 'waypoint_get':
    case 'waypoint_use':
      return 'waypoint';
    case 'portal_set':
    case 'portal_use':
      return 'portal';
    case 'trial':
    case 'ascend':
      return 'trial';
    case 'crafting':
      return 'crafting';
    default:
      return 'plain';
  }
}

export function fragmentIcon(
  fragment: Fragments.AnyFragment
): IconName | null {
  if (typeof fragment === 'string') return null;

  switch (fragment.type) {
    case 'waypoint':
    case 'waypoint_get':
    case 'waypoint_use':
      return 'waypoint';
    case 'portal_set':
    case 'portal_use':
      return 'portal';
    case 'quest':
      return 'quest';
    case 'trial':
    case 'ascend':
      return 'trial';
    case 'crafting':
      return 'crafting';
    case 'enter':
    case 'logout':
      // Only towns carry the town icon, regular zones do not.
      return Data.Areas[fragment.areaId]?.is_town_area === true ? 'town' : null;
    default:
      return null;
  }
}
