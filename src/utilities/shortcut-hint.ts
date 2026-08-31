import type { RouteData } from '@/lib/exile-leveling';
import { SHORTCUT_CLOSE_OVERLAY, shortcutLabel } from './shortcuts';

/**
 * Die einzige Zeile des Guides, die nicht aus der Route kommt.
 *
 * Am Ende steht man vor einem Fenster, das man zumachen will. Das Kuerzel
 * dafuer steht sonst nur in den Einstellungen, und dort sieht mitten im Spiel
 * niemand nach.
 *
 * Ohne Kantenindex: es ist kein Schritt der Route, sondern eine Unterzeile am
 * letzten.
 */
export const OVERLAY_SHORTCUT_HINT: RouteData.FragmentStep = {
  type: 'fragment_step',
  parts: [`${shortcutLabel(SHORTCUT_CLOSE_OVERLAY)} closes the overlay.`],
  subSteps: [],
  edgeIndex: null
};

/**
 * Haengt den Hinweis als Unterzeile an den letzten Schritt der Route.
 *
 * Bewusst hier und nicht in `buildDefaultRoute`: der soll genau das erzeugen,
 * was der Upstream-Parser erzeugt, und ein Golden-File-Test haelt ihn darauf
 * fest. Was die App darueber hinaus zeigt, kommt an dieser Stelle dazu.
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

  // Keine Route, kein Ende, nichts anzuhaengen.
  return route;
}
