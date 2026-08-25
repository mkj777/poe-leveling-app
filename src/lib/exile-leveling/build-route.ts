import type { GameDataBundle } from './data';
import type { RouteData } from './types';
import { setGameData } from './data';
import {
  getRouteFiles,
  initializeRouteState,
  parseRoute
} from './route-processing/index';

// Feste Routenvariante, siehe ADR-0007. Entspricht den Defaults der Website
// (web/src/state/build-data.ts): leagueStart true, library true, bandit Alira,
// kein PoB-Import und damit keine Gem-Schritte.
const PREPROCESSOR_DEFINITIONS = ['LEAGUE_START', 'LIBRARY', 'BANDIT_ALIRA'];

export function buildDefaultRoute(
  routeSources: string[],
  gameData: GameDataBundle
): RouteData.Route {
  setGameData(gameData);

  const state = initializeRouteState();
  for (const definition of PREPROCESSOR_DEFINITIONS) {
    state.preprocessorDefinitions.add(definition);
  }

  return parseRoute(getRouteFiles(routeSources), state);
}
