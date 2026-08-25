// Fortschritt laeuft ueber den Kantenindex, nicht ueber Zonennamen (ADR-0004).
// Zonen werden mehrfach betreten, ein Namensvergleich ist darum nicht eindeutig.
const AREA_PATTERN = /Generating level \d+ area "(.*?)"/;

export function parseAreaFromLog(line: string): string | null {
  const match = AREA_PATTERN.exec(line);
  return match === null ? null : match[1];
}

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
