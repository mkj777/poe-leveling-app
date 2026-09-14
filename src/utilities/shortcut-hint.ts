import type { RouteData } from '@/lib/exile-leveling';
import { SHORTCUT_CLOSE_OVERLAY, shortcutLabel } from './shortcuts';

/**
 * The only line of the guide that does not come from the route.
 *
 * At the end you are looking at a window you want to close. The shortcut for
 * that otherwise appears only in the settings, and nobody looks there in the
 * middle of a game.
 *
 * Without an edge index: it is not a step of the route but a subline on the
 * last one.
 */
export const OVERLAY_SHORTCUT_HINT: RouteData.FragmentStep = {
  type: 'fragment_step',
  parts: [`${shortcutLabel(SHORTCUT_CLOSE_OVERLAY)} closes the overlay.`],
  subSteps: [],
  edgeIndex: null
};

/**
 * Appends the hint as a subline to the last step of the route.
 *
 * Deliberately here and not in `buildDefaultRoute`: that one should produce
 * exactly what the upstream parser produces, and a golden-file test pins it
 * to that. Whatever the app shows beyond that is added at this point.
 */
export function withShortcutHint(route: RouteData.Route): RouteData.Route {
  for (let index = route.sections.length - 1; index >= 0; index--) {
    const steps = route.sections[index].steps;

    for (let position = steps.length - 1; position >= 0; position--) {
      const step = steps[position];
      if (step.type !== 'fragment_step') continue;

      const withHint: RouteData.FragmentStep = {
        ...step,
        subSteps: [...step.subSteps, OVERLAY_SHORTCUT_HINT]
      };

      const sections = [...route.sections];
      sections[index] = {
        ...route.sections[index],
        steps: [
          ...steps.slice(0, position),
          withHint,
          ...steps.slice(position + 1)
        ]
      };

      return { ...route, sections };
    }
  }

  // No route, no end, nothing to append.
  return route;
}
