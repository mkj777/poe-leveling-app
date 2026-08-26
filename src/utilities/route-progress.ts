import type { RouteData } from '@/lib/exile-leveling';

// Fortschritt laeuft ueber den Kantenindex, nicht ueber Zonennamen (ADR-0004).
// Zonen werden mehrfach betreten, ein Namensvergleich ist darum nicht eindeutig.
// Die Area-Id kommt aus dem Rust-Command get_area_name, das Client.txt liest.

export function advanceEdge(
  edges: string[],
  currentEdge: number,
  areaId: string
): number {
  const next = currentEdge + 1;
  if (next >= edges.length) return currentEdge;
  return edges[next] === areaId ? next : currentEdge;
}

/**
 * Knuepft den Fortschritt nach einem Daten-Refresh wieder an, ohne auf 0
 * zurueckzufallen.
 *
 * Frueher stand hier `edges.lastIndexOf(areaId)`, also das letzte Vorkommen
 * der Zone. Das ist fast immer die falsche Kante: 46 der 149 Zonen der Route
 * werden mehrfach betreten, The Forest Encampment etwa auf den Kanten 135,
 * 137, 145, 150 und 156. Wer bei 135 aufhoerte, stand nach dem Neustart auf
 * 156, also 21 Kanten weiter. Das Overlay blieb dabei richtig, weil es nicht
 * durch useRouteSync laeuft und den gespeicherten Index behaelt.
 *
 * Der gespeicherte Index ist die genauere Angabe, die Zone nur der Notnagel
 * fuer den Fall, dass sich die Route unter ihm veraendert hat.
 */
export function reanchorEdge(
  edges: string[],
  areaId: string,
  fallback: number
): number {
  // Zeigt der gespeicherte Index noch auf dieselbe Zone, gibt es nichts
  // anzuknuepfen. Das ist der Normalfall bei jedem Start.
  if (edges[fallback] === areaId) return fallback;

  // Sonst das naechstgelegene Vorkommen. Bei gleichem Abstand gewinnt das
  // fruehere: zu weit vorne zu stehen kostet einen Blick, zu weit hinten
  // laesst Schritte aus.
  let best = -1;
  for (let index = 0; index < edges.length; index++) {
    if (edges[index] !== areaId) continue;
    if (best === -1 || Math.abs(index - fallback) < Math.abs(best - fallback)) {
      best = index;
    }
  }

  return best === -1 ? fallback : best;
}

// Die Sektionen sind Akte, fuer Anzeige und Fortschritt zaehlt aber die
// durchgehende Schrittfolge.
export function flattenSteps(
  sections: RouteData.Section[]
): RouteData.FragmentStep[] {
  return sections
    .flatMap((section) => section.steps)
    .filter(
      (step): step is RouteData.FragmentStep => step.type === 'fragment_step'
    );
}

// Die Liste im Hauptfenster zeigt einen Block je Kante. Ein Block ist genau
// das, wohin "Jump here" springt, und bekommt darum genau einen Trenner. Vorher
// trug jede Zeile einen, und damit war nicht zu sehen, welcher Text noch zum
// selben Schritt gehoert.
export function groupSteps(
  steps: RouteData.FragmentStep[]
): RouteData.FragmentStep[][] {
  const groups: RouteData.FragmentStep[][] = [];

  for (const step of steps) {
    // Schritte vor der ersten Kante kommen in der echten Route nicht vor,
    // landen aber in einem eigenen Block statt unter den Tisch zu fallen.
    if (step.edgeIndex !== null || groups.length === 0) groups.push([step]);
    else groups[groups.length - 1].push(step);
  }

  return groups;
}

export interface ActProgress {
  /** Name der Sektion, also der Akt. */
  act: string;
  /** Kantenschritte in diesem Akt, die noch kommen. */
  stepsLeft: number;
  /** Kantenschritte im Akt insgesamt. */
  stepsTotal: number;
}

/**
 * In welchem Akt die aktuelle Kante liegt und wie viel davon noch aussteht.
 * Gezaehlt werden Kantenschritte, also Zonenwechsel, weil das die Einheit ist,
 * in der der Fortschritt laeuft.
 */
export function actProgress(
  sections: RouteData.Section[],
  currentEdge: number
): ActProgress | null {
  for (const section of sections) {
    const edges = section.steps
      .filter(
        (step): step is RouteData.FragmentStep =>
          step.type === 'fragment_step' && step.edgeIndex !== null
      )
      .map((step) => step.edgeIndex as number);

    const position = edges.indexOf(currentEdge);
    if (position === -1) continue;

    return {
      act: section.name,
      stepsLeft: edges.length - position - 1,
      stepsTotal: edges.length
    };
  }

  return null;
}

/**
 * Was jetzt ansteht. Der Kopfschritt einer Kante ist der Uebergang in die Zone
 * hinein, und der ist erledigt, sobald Client.txt die Zone meldet und der
 * Fortschritt weiterspringt. Er faellt darum weg. Uebrig bleibt der Rest der
 * Zone, gefolgt vom naechsten Uebergang als eigentlich naechster Aktion.
 *
 * Ohne das zeigte das Overlay in 101 von 248 Segmenten nur den gerade
 * ausgefuehrten Uebergang und sonst nichts.
 */
export function selectPending(
  steps: RouteData.FragmentStep[],
  currentEdge: number
): RouteData.FragmentStep[] {
  const start = steps.findIndex((step) => step.edgeIndex === currentEdge);
  if (start === -1) return [];

  const pending: RouteData.FragmentStep[] = [];
  for (let index = start + 1; index < steps.length; index++) {
    pending.push(steps[index]);
    // Der naechste Uebergang ist die letzte Zeile: was dahinter kommt, gehoert
    // in eine Zone, die noch nicht betreten ist.
    if (steps[index].edgeIndex !== null) break;
  }

  // Ende der Route. Statt einer leeren Karte bleibt der erreichte Schritt
  // stehen.
  return pending.length === 0 ? [steps[start]] : pending;
}
