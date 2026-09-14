import type { RouteData } from '@/lib/exile-leveling';

// Progress runs on the edge index, not on zone names (ADR-0004). Zones are
// entered more than once, so a name comparison is ambiguous. The area id
// comes from the Rust command get_area_name, which reads Client.txt.

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
 * Re-anchors progress after a data refresh without falling back to 0.
 *
 * This used to be `edges.lastIndexOf(areaId)`, the last occurrence of the
 * zone. That is almost always the wrong edge: 46 of the 149 zones of the
 * route are entered more than once, The Forest Encampment for instance on
 * edges 135, 137, 145, 150 and 156. Anyone who stopped at 135 stood at 156
 * after the restart, 21 edges further. The overlay stayed correct because it
 * does not go through useRouteSync and keeps the stored index.
 *
 * The stored index is the more precise value, the zone only the fallback for
 * the case that the route underneath has changed.
 */
export function reanchorEdge(
  edges: string[],
  areaId: string,
  fallback: number
): number {
  // If the stored index still points at the same zone, there is nothing to
  // re-anchor. That is the normal case on every start.
  if (edges[fallback] === areaId) return fallback;

  // Otherwise the nearest occurrence. On a tie the earlier one wins:
  // standing too far ahead costs a glance, standing too far behind skips
  // steps.
  let best = -1;
  for (let index = 0; index < edges.length; index++) {
    if (edges[index] !== areaId) continue;
    if (best === -1 || Math.abs(index - fallback) < Math.abs(best - fallback)) {
      best = index;
    }
  }

  if (best !== -1) return best;

  // If the zone no longer occurs at all, the stored index stays, clamped to
  // the new length. That is the case on a mode switch: four zones exist only
  // at league start, and its edge list is the longer one. The Ossuary sits on
  // edge 233 there, speedleveling has 236. An index past that would not be a
  // step any more but an empty overlay with no error message.
  return Math.max(0, Math.min(fallback, edges.length - 1));
}

// The sections are acts, but for display and progress the continuous step
// sequence is what counts.
export function flattenSteps(
  sections: RouteData.Section[]
): RouteData.FragmentStep[] {
  return sections
    .flatMap((section) => section.steps)
    .filter(
      (step): step is RouteData.FragmentStep => step.type === 'fragment_step'
    );
}

/**
 * One block of the list in the main window: the steps done while standing at
 * one edge.
 *
 * `edgeIndex` is the edge one is **standing** at, not the one the last step
 * leads into. A block ends with the transition into the next zone, because
 * what comes after is done only there.
 */
export interface StepBlock {
  edgeIndex: number | null;
  steps: RouteData.FragmentStep[];
}

export interface SectionBlocks {
  name: string;
  blocks: StepBlock[];
}

/**
 * Splits the route into blocks exactly as `selectPending` selects them for
 * the overlay. Both must yield the same, otherwise the list shows a different
 * step than the overlay.
 *
 * A block used to begin with the transition into its zone. But that is
 * already done as soon as Client.txt reports the zone: the list thus
 * highlighted the step just made while the overlay showed the next one. At
 * edge 53 the list said "➞ The Slums" and the overlay "➞ The Crematorium".
 *
 * Blocks run across act boundaries, because the last step of an act and the
 * transition into the next belong together. A block lands in the act it
 * starts in.
 */
export function blockSections(
  sections: RouteData.Section[]
): SectionBlocks[] {
  const result: SectionBlocks[] = sections.map((section) => ({
    name: section.name,
    blocks: []
  }));

  let edgeIndex: number | null = null;
  let current: RouteData.FragmentStep[] = [];
  let startedIn = 0;

  sections.forEach((section, index) => {
    for (const step of section.steps) {
      if (step.type !== 'fragment_step') continue;

      if (current.length === 0) startedIn = index;
      current.push(step);

      if (step.edgeIndex !== null) {
        result[startedIn].blocks.push({ edgeIndex, steps: current });
        edgeIndex = step.edgeIndex;
        current = [];
      }
    }
  });

  // Whatever comes after the last transition belongs to the last reached
  // edge.
  if (current.length > 0) {
    result[startedIn].blocks.push({ edgeIndex, steps: current });
  }

  return result;
}

export interface ActProgress {
  /** Name of the section, that is, the act. */
  act: string;
  /** Edge steps in this act still to come. */
  stepsLeft: number;
  /** Edge steps in the act in total. */
  stepsTotal: number;
}

/**
 * Which act the current edge lies in and how much of it is still pending.
 * Edge steps are counted, that is, zone changes, because that is the unit
 * progress runs in.
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
 * What is pending now. The head step of an edge is the transition into the
 * zone, and that is done as soon as Client.txt reports the zone and progress
 * jumps ahead. So it is dropped. What remains is the rest of the zone,
 * followed by the next transition as the actual next action.
 *
 * Without this the overlay showed, in 101 of 248 segments, only the
 * transition just made and nothing else.
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
    // The next transition is the last line: what comes after belongs to a
    // zone not yet entered.
    if (steps[index].edgeIndex !== null) break;
  }

  // End of the route. Instead of an empty card the reached step stays.
  return pending.length === 0 ? [steps[start]] : pending;
}
