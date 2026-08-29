import type { GameDataBundle } from './data';
import type { GuideMode } from '@/utilities/guide-mode';
import type { RouteData } from './types';
import { PREPROCESSOR_DEFINITIONS, filterRoute } from '@/utilities/guide-mode';
import { setGameData } from './data';
import {
  getRouteFiles,
  initializeRouteState,
  parseRoute
} from './route-processing/index';

/**
 * Feste Routenvariante, siehe ADR-0007. `league-start` entspricht den Defaults
 * der Website (web/src/state/build-data.ts): leagueStart true, library true,
 * bandit Alira, kein PoB-Import und damit keine Gem-Schritte.
 *
 * Der Modus wirkt zweimal: er waehlt die Preprocessor-Schalter, mit denen die
 * Route ueberhaupt erst entsteht, und filtert danach, was der Preprocessor
 * nicht abdeckt (ADR-0011).
 */
export function buildDefaultRoute(
  routeSources: string[],
  gameData: GameDataBundle,
  mode: GuideMode
): RouteData.Route {
  setGameData(gameData);

  const state = initializeRouteState();
  for (const definition of PREPROCESSOR_DEFINITIONS[mode]) {
    state.preprocessorDefinitions.add(definition);
  }

  return filterRoute(parseRoute(getRouteFiles(routeSources), state), mode);
}
