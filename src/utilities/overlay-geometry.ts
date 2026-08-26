import {
  OVERLAY_BASE_WIDTH,
  OVERLAY_BOTTOM_MARGIN,
  OVERLAY_MAX_WIDTH,
  OVERLAY_MIN_WIDTH,
  OVERLAY_MINIMAP_TOP,
  OVERLAY_SIDE_MARGIN
} from './constants';

// Payload des poe-bounds-Events aus src-tauri/src/overlay.rs.
export interface PoeBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  focused: boolean;
  exclusiveFullscreen: boolean;
  found: boolean;
}

// Feinverschiebung als Bruchteil des Spiel-Rects, nicht in Pixeln. Nur so
// ueberlebt sie Aufloesungs- und Monitorwechsel (ADR-0006).
export interface OverlayOffset {
  dx: number;
  dy: number;
}

export interface OverlayRect {
  x: number;
  y: number;
  width: number;
}

export type OverlayAnchor = 'minimap' | 'bottom';

/**
 * Ein Anker besteht aus zwei Teilen: wo im Spielfenster er sitzt, und mit
 * welcher eigenen Ecke das Overlay daran haengt. Letzteres bestimmt, in welche
 * Richtung das Fenster waechst, wenn der Text laenger wird.
 */
const ANCHORS: Record<
  OverlayAnchor,
  { point: { x: number; y: number }; pin: { x: number; y: number } }
> = {
  // Unter der Minimap: rechts buendig, waechst nach unten.
  minimap: {
    point: { x: 1 - OVERLAY_SIDE_MARGIN, y: OVERLAY_MINIMAP_TOP },
    pin: { x: 1, y: 0 }
  },
  // Mitte unten: waechst nach oben, die Unterkante bleibt ueber der HUD-Zeile.
  bottom: {
    point: { x: 0.5, y: 1 - OVERLAY_BOTTOM_MARGIN },
    pin: { x: 0.5, y: 1 }
  }
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function overlayWidth(bounds: PoeBounds, scale: number): number {
  // Die Klemme haelt die Grundbreite in einem brauchbaren Bereich, unabhaengig
  // von der Spielaufloesung. Sie darf aber nicht auf das skalierte Ergebnis
  // wirken: sonst waechst ab einem gewissen Faktor nur noch die Schrift,
  // waehrend das Fenster stehen bleibt und der Text darin umbricht.
  const base = clamp(
    bounds.w * OVERLAY_BASE_WIDTH,
    OVERLAY_MIN_WIDTH,
    OVERLAY_MAX_WIDTH
  );

  return Math.round(base * scale);
}

export function computeOverlayRect(
  bounds: PoeBounds,
  height: number,
  scale: number,
  offset: OverlayOffset,
  anchor: OverlayAnchor
): OverlayRect {
  const { point, pin } = ANCHORS[anchor];
  const width = overlayWidth(bounds, scale);

  const anchorX = bounds.x + bounds.w * (point.x + offset.dx);
  const anchorY = bounds.y + bounds.h * (point.y + offset.dy);

  return {
    x: Math.round(anchorX - width * pin.x),
    y: Math.round(anchorY - height * pin.y),
    width
  };
}

/**
 * Die Umkehrung: aus einer vom Nutzer gezogenen Fensterlage den relativen
 * Offset zurueckrechnen. Muss exakt invers zu computeOverlayRect sein, sonst
 * wandert das Overlay bei jedem Zyklus ein Stueck weiter.
 */
export function offsetFromWindow(
  bounds: PoeBounds,
  window: { x: number; y: number; width: number; height: number },
  anchor: OverlayAnchor
): OverlayOffset {
  // Ohne Spielfenster gibt es keinen Bezug, aus dem sich ein relativer Offset
  // ableiten liesse. Die Division wuerde Infinity liefern, und der Wert wird
  // gespeichert: das Overlay waere danach dauerhaft verschoben.
  if (bounds.w === 0 || bounds.h === 0) {
    return { dx: 0, dy: 0 };
  }

  const { point, pin } = ANCHORS[anchor];

  const pinX = window.x + window.width * pin.x;
  const pinY = window.y + window.height * pin.y;

  return {
    dx: (pinX - bounds.x) / bounds.w - point.x,
    dy: (pinY - bounds.y) / bounds.h - point.y
  };
}
