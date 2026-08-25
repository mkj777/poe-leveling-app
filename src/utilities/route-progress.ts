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

// Knuepft den Fortschritt nach einem Daten-Refresh wieder an, ohne auf 0
// zurueckzufallen.
export function reanchorEdge(
  edges: string[],
  areaId: string,
  fallback: number
): number {
  const index = edges.lastIndexOf(areaId);
  return index === -1 ? fallback : index;
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

// Alles, was zur aktuellen Kante gehoert: der Schritt, der die Zone betritt,
// plus alle folgenden Schritte ohne eigenen Zonenwechsel. Genau das gehoert
// ins Overlay, nicht die ganze Route.
export function selectSegment(
  steps: RouteData.FragmentStep[],
  currentEdge: number
): RouteData.FragmentStep[] {
  const start = steps.findIndex((step) => step.edgeIndex === currentEdge);
  if (start === -1) return [];

  const segment: RouteData.FragmentStep[] = [steps[start]];
  for (let index = start + 1; index < steps.length; index++) {
    if (steps[index].edgeIndex !== null) break;
    segment.push(steps[index]);
  }

  return segment;
}
