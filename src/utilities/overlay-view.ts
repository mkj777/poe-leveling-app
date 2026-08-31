import type { Fragments, RouteData } from '@/lib/exile-leveling';
import type { FragmentColour, IconName } from './fragment-style';
import { actProgress, flattenSteps, selectPending } from './route-progress';
import { fragmentColour, fragmentIcon } from './fragment-style';
import { renderFragment } from './fragment-text';

/**
 * Was das Overlay anzeigt, fertig ausgerechnet.
 *
 * Das Overlay ist Anzeige und sonst nichts (ADR-0012). Es haelt keine Route,
 * keine Spieldaten und keinen Fortschritt, es bekommt Zeilen und malt sie.
 * Alles hier ist einfaches JSON: es geht als Ereignis ueber die Fenstergrenze.
 */
export interface FragmentView {
  text: string;
  colour: FragmentColour;
  icon: IconName | null;
}

/** Eine Zeile, also ein Schritt oder ein Unterschritt. */
export type LineView = FragmentView[];

export interface StepView {
  parts: LineView;
  subSteps: LineView[];
}

export interface OverlayView {
  /** Der Akt, oder null solange keine Route geladen ist. */
  act: string | null;
  /** Kantenschritte, die im Akt noch ausstehen. */
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
 * Was jetzt ansteht, in der Form, in der es das Overlay braucht. Laeuft im
 * Hauptfenster: nur dort liegen Route und Spieldaten.
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

/** Das Overlay meldet sich, sobald es horcht, und bekommt den Stand geschickt. */
export const OVERLAY_READY_EVENT = 'overlay-ready';

/** Hauptfenster an Overlay: das hier anzeigen. */
export const OVERLAY_VIEW_EVENT = 'overlay-view';

/**
 * Overlay an Hauptfenster: der Nutzer hat es gezogen oder skaliert.
 *
 * Die Gegenrichtung. Gespeichert wird im Hauptfenster, dem die Einstellungen
 * gehoeren. Schrieben beide, ueberschriebe der eine still den anderen, und
 * genau das ist beim Fortschritt schon passiert (ADR-0011, zweiter Nachtrag).
 */
export const OVERLAY_PLACEMENT_EVENT = 'overlay-placement';

export interface OverlayPlacement {
  overlayScale: number;
  overlayOffset: { dx: number; dy: number };
}
