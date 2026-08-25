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
  if (bundle === null) {
    throw new Error('Spieldaten nicht geladen, setGameData zuerst aufrufen');
  }
  return bundle;
}

// Ersetzt die statischen JSON-Importe des Upstreams durch den Laufzeit-Cache.
// Zugriff vor setGameData wirft, damit Reihenfolgefehler laut scheitern statt
// still falsch zu rechnen.
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
