import type { Fragments, RouteData } from '@/lib/exile-leveling';
import type { FragmentColour, IconName } from './fragment-style';
import { actProgress, flattenSteps, selectPending } from './route-progress';
import { fragmentColour, fragmentIcon } from './fragment-style';
import { renderFragment } from './fragment-text';

/**
 * What the overlay displays, fully computed.
 *
 * The overlay is a display and nothing else (ADR-0012). It holds no route, no
 * game data and no progress; it receives lines and paints them. Everything
 * here is plain JSON: it crosses the window boundary as an event.
 */
export interface FragmentView {
  text: string;
  colour: FragmentColour;
  icon: IconName | null;
}

/** One line, that is, a step or a substep. */
export type LineView = FragmentView[];

export interface StepView {
  parts: LineView;
  subSteps: LineView[];
}

export interface OverlayView {
  /** The act, or null while no route is loaded. */
  act: string | null;
  /** Edge steps still pending in the act. */
  stepsLeft: number;
  steps: StepView[];
}

export const EMPTY_OVERLAY_VIEW: OverlayView = {
  act: null,
  stepsLeft: 0,
  steps: []
};

export function toLineView(parts: Fragments.AnyFragment[]): LineView {
  return parts.map((fragment) => ({
    text: renderFragment(fragment),
    colour: fragmentColour(fragment),
    icon: fragmentIcon(fragment)
  }));
}

export function toStepView(step: RouteData.FragmentStep): StepView {
  return {
    parts: toLineView(step.parts),
    subSteps: step.subSteps.map((subStep) => toLineView(subStep.parts))
  };
}

/**
 * What is pending now, in the form the overlay needs. Runs in the main
 * window: only there do route and game data live.
 */
export function buildOverlayView(
  route: RouteData.Route,
  currentEdge: number
): OverlayView {
  const steps = selectPending(flattenSteps(route.sections), currentEdge);
  const act = actProgress(route.sections, currentEdge);

  return {
    act: act === null ? null : act.act,
    stepsLeft: act === null ? 0 : act.stepsLeft,
    steps: steps.map(toStepView)
  };
}

/** The overlay reports in as soon as it listens and gets the state sent. */
export const OVERLAY_READY_EVENT = 'overlay-ready';

/** Main window to overlay: display this. */
export const OVERLAY_VIEW_EVENT = 'overlay-view';

/**
 * Overlay to main window: the user dragged or scaled it.
 *
 * The reverse direction. Saving happens in the main window, which owns the
 * settings. If both wrote, one would silently overwrite the other, and
 * exactly that already happened with progress (ADR-0011, second addendum).
 */
export const OVERLAY_PLACEMENT_EVENT = 'overlay-placement';

export interface OverlayPlacement {
  overlayScale: number;
  overlayOffset: { dx: number; dy: number };
}
