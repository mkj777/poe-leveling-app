import type { RouteData } from '@/lib/exile-leveling';

/**
 * Two modes of the same route.
 *
 * `league-start` is the previous flow: first character of a league,
 * everything is collected along the way.
 *
 * `speedleveling` is the second character in the same league. Crafting
 * recipes and completed trials already count there, the steps for them are
 * just detours.
 */
export type GuideMode = 'league-start' | 'speedleveling';

/** Title and explanation per mode, shared by the dialog and the settings. */
export const GUIDE_MODE_OPTIONS: {
  mode: GuideMode;
  title: string;
  hint: string;
}[] = [
  {
    mode: 'league-start',
    title: 'League start',
    hint: 'First character of the league. Picks up every crafting recipe and every trial, and takes the detours that only pay off on a fresh account.'
  },
  {
    mode: 'speedleveling',
    title: 'Speedleveling',
    hint: 'Another character in the same league. Recipes and trials already count there, so those steps and the league start detours are left out.'
  }
];

/**
 * Preprocessor switches of the route per mode, see ADR-0007 for the fixed
 * variant and ADR-0011 for the modes.
 *
 * `LEAGUE_START` is an upstream switch. It hides the detours that only exist
 * at league start: Tidal Island with Hailrake, The Den, the Catacombs, the
 * Silver Locket, the Ossuary and the search for the Chemist's Strongbox. It
 * takes all 12 trials with it, but only 7 of the 47 crafting steps.
 * filterRoute does the rest.
 */
export const PREPROCESSOR_DEFINITIONS: Record<GuideMode, string[]> = {
  'league-start': ['LEAGUE_START', 'LIBRARY', 'BANDIT_ALIRA'],
  speedleveling: ['LIBRARY', 'BANDIT_ALIRA']
};

/** Fragments that have nothing left to say in speedleveling. */
const SKIPPED_TYPES: ReadonlySet<string> = new Set(['crafting', 'trial']);

/**
 * Fragments that only name a place or a direction instead of being an action
 * themselves. They do not keep a step alive when the action in it goes away.
 *
 * This is exactly what the only two mixed steps of the route hang on:
 * "➞ Eternal Laboratory, get Crafting: Fire Damage" consists, apart from the
 * recipe, only of the place entered for it, and "Before waypoint, complete
 * Trial of Ascendancy" names the waypoint as a landmark, not as a task. Both
 * therefore go entirely.
 */
const LANDMARK_TYPES: ReadonlySet<string> = new Set([
  'area',
  'arena',
  'waypoint',
  'dir',
  'copy'
]);

/**
 * Whether a step is dropped in speedleveling.
 *
 * Deliberately conservative: only what leaves nothing to do without crafting
 * and trial is removed. A "Kill X, get Crafting" added later would therefore
 * stay, recipe included. Better one line too many than a boss overlooked.
 *
 * A step with an edge index always stays. Progress hangs on it (ADR-0004),
 * and a zone change is no collection task anyway. In today's route this
 * affects none of the 59 steps; it is the guarantee for tomorrow.
 */
export function isSkippable(step: RouteData.FragmentStep): boolean {
  if (step.edgeIndex !== null) return false;

  let skipped = false;

  for (const part of step.parts) {
    if (typeof part === 'string') continue;

    if (SKIPPED_TYPES.has(part.type)) {
      skipped = true;
      continue;
    }

    if (!LANDMARK_TYPES.has(part.type)) return false;
  }

  return skipped;
}

function pruneSubSteps(step: RouteData.Step): RouteData.Step {
  if (step.type !== 'fragment_step') return step;

  const subSteps = step.subSteps.filter((subStep) => !isSkippable(subStep));
  if (subSteps.length === step.subSteps.length) return step;

  return { ...step, subSteps };
}

/**
 * The same route, just without the steps the mode does not need.
 *
 * `edges` stays untouched. Progress counts edges, not steps, and no removed
 * step carries one.
 */
export function filterRoute(
  route: RouteData.Route,
  mode: GuideMode
): RouteData.Route {
  if (mode === 'league-start') return route;

  return {
    edges: route.edges,
    sections: route.sections.map((section) => ({
      name: section.name,
      steps: section.steps
        .filter((step) => step.type !== 'fragment_step' || !isSkippable(step))
        .map(pruneSubSteps)
    }))
  };
}

/**
 * After this pause the app asks about a new run at startup. Eleven days: a
 * league runs about 13 weeks, and anyone who has not looked in for that long
 * almost always starts over. A few days of pause mid-run trigger nothing.
 */
export const NEW_RUN_AFTER_MS = 11 * 24 * 60 * 60 * 1000;

/**
 * On the very first start there is nothing to ask: there is neither progress
 * nor a mode to deviate from. A clock that jumps back does not lead to a
 * question either.
 */
export function shouldOfferNewRun(
  lastOpenedAt: number | null,
  now: number
): boolean {
  if (lastOpenedAt === null) return false;
  return now - lastOpenedAt >= NEW_RUN_AFTER_MS;
}
