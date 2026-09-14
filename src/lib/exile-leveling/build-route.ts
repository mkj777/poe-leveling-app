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
 * Fixed route variant, see ADR-0007. `league-start` matches the defaults of
 * the website (web/src/state/build-data.ts): leagueStart true, library true,
 * bandit Alira, no PoB import and therefore no gem steps.
 *
 * The mode acts twice: it picks the preprocessor switches the route is built
 * with in the first place, and afterwards filters what the preprocessor does
 * not cover (ADR-0011).
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
