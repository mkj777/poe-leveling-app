import type { GameData } from './types';

export interface GameDataBundle {
  Areas: GameData.Areas;
  AwakenedGemLookup: GameData.VariantGemLookup;
  Characters: GameData.Characters;
  GemColours: GameData.GemColours;
  Gems: GameData.Gems;
  KillWaypoints: GameData.KillWaypoints;
  Quests: GameData.Quests;
  VaalGemLookup: GameData.VariantGemLookup;
}

let bundle: GameDataBundle | null = null;

export function setGameData(next: GameDataBundle) {
  bundle = next;
}

function required(): GameDataBundle {
  // Catch undefined too: the caller comes from JSON and from an event, both
  // of which can yield undefined without TypeScript seeing it.
  if (bundle === null || bundle === undefined) {
    throw new Error('Game data not loaded, call setGameData first');
  }
  return bundle;
}

// Replaces upstream's static JSON imports with the runtime cache. Access
// before setGameData throws, so ordering mistakes fail loudly instead of
// silently computing wrong results.
export const Data = {
  get Areas() {
    return required().Areas;
  },
  get AwakenedGemLookup() {
    return required().AwakenedGemLookup;
  },
  get Characters() {
    return required().Characters;
  },
  get GemColours() {
    return required().GemColours;
  },
  get Gems() {
    return required().Gems;
  },
  get KillWaypoints() {
    return required().KillWaypoints;
  },
  get Quests() {
    return required().Quests;
  },
  get VaalGemLookup() {
    return required().VaalGemLookup;
  }
};
