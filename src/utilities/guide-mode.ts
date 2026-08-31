import type { RouteData } from '@/lib/exile-leveling';

/**
 * Zwei Lesarten derselben Route.
 *
 * `league-start` ist der bisherige Ablauf: erster Charakter einer Liga, alles
 * wird unterwegs eingesammelt.
 *
 * `speedleveling` ist der zweite Charakter in derselben Liga. Craftingrezepte
 * und abgeschlossene Trials gelten dort schon, die Schritte dafuer sind nur
 * noch Umweg.
 */
export type GuideMode = 'league-start' | 'speedleveling';

/** Titel und Erklaerung je Modus, geteilt von Dialog und Einstellungen. */
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
 * Preprocessor-Schalter der Route je Modus, siehe ADR-0007 fuer die feste
 * Variante und ADR-0011 fuer die Modi.
 *
 * `LEAGUE_START` ist ein Schalter des Upstreams. Er blendet die Umwege aus,
 * die es nur beim Ligastart gibt: Tidal Island mit Hailrake, The Den, die
 * Catacombs, das Silver Locket, die Ossuary und die Suche nach der Chemist's
 * Strongbox. Er nimmt dabei alle 12 Trials mit, aber nur 7 der 47
 * Craftingschritte. Den Rest erledigt filterRoute.
 */
export const PREPROCESSOR_DEFINITIONS: Record<GuideMode, string[]> = {
  'league-start': ['LEAGUE_START', 'LIBRARY', 'BANDIT_ALIRA'],
  speedleveling: ['LIBRARY', 'BANDIT_ALIRA']
};

/** Fragmente, die im Speedleveling nichts mehr zu sagen haben. */
const SKIPPED_TYPES: ReadonlySet<string> = new Set(['crafting', 'trial']);

/**
 * Fragmente, die nur einen Ort oder eine Richtung nennen, statt selbst eine
 * Handlung zu sein. Sie halten einen Schritt nicht am Leben, wenn die Handlung
 * darin wegfaellt.
 *
 * Genau daran haengen die beiden einzigen gemischten Schritte der Route:
 * "➞ Eternal Laboratory, get Crafting: Fire Damage" besteht ausser dem Rezept
 * nur aus dem Ort, den man dafuer betritt, und "Before waypoint, complete
 * Trial of Ascendancy" nennt den Wegpunkt als Wegmarke, nicht als Aufgabe.
 * Beide fallen darum ganz weg.
 */
const LANDMARK_TYPES: ReadonlySet<string> = new Set([
  'area',
  'arena',
  'waypoint',
  'dir',
  'copy'
]);

/**
 * Ob ein Schritt im Speedleveling entfaellt.
 *
 * Bewusst zurueckhaltend: entfernt wird nur, was ohne Crafting und Trial gar
 * nichts mehr zu tun uebrig laesst. Ein spaeter dazukommendes
 * "Kill X, get Crafting" bliebe also stehen, mitsamt dem Rezept. Lieber eine
 * Zeile zu viel als ein uebersehener Boss.
 *
 * Ein Schritt mit Kantenindex bleibt immer. An ihm haengt der Fortschritt
 * (ADR-0004), und ein Zonenwechsel ist ohnehin keine Sammelaufgabe. In der
 * Route von heute trifft das keinen einzigen der 59 Schritte, es ist die
 * Zusicherung fuer morgen.
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
 * Dieselbe Route, nur ohne die Schritte, die der Modus nicht braucht.
 *
 * `edges` bleibt unangetastet. Der Fortschritt zaehlt Kanten, keine Schritte,
 * und kein entfernter Schritt traegt eine.
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
 * Nach dieser Pause fragt die App beim Start nach einem neuen Durchgang. Elf
 * Tage: eine Liga laeuft rund 13 Wochen, und wer so lange nicht hereingesehen
 * hat, faengt fast immer neu an. Ein paar Tage Pause mitten im Durchgang
 * loesen dagegen nichts aus.
 */
export const NEW_RUN_AFTER_MS = 11 * 24 * 60 * 60 * 1000;

/**
 * Beim allerersten Start gibt es nichts zu fragen: es gibt weder Fortschritt
 * noch einen Modus, von dem man abweichen koennte. Eine Uhr, die zurueckspringt,
 * fuehrt ebenfalls zu keiner Frage.
 */
export function shouldOfferNewRun(
  lastOpenedAt: number | null,
  now: number
): boolean {
  if (lastOpenedAt === null) return false;
  return now - lastOpenedAt >= NEW_RUN_AFTER_MS;
}
