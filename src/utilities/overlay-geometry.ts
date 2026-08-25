import {
  OVERLAY_ANCHOR,
  OVERLAY_BASE_WIDTH,
  OVERLAY_BOTTOM_MARGIN,
  OVERLAY_MAX_WIDTH,
  OVERLAY_MIN_WIDTH
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeOverlayRect(
  bounds: PoeBounds,
  height: number,
  scale: number,
  offset: OverlayOffset
): OverlayRect {
  const width = Math.round(
    clamp(
      bounds.w * OVERLAY_BASE_WIDTH * scale,
      OVERLAY_MIN_WIDTH,
      OVERLAY_MAX_WIDTH
    )
  );

  const centerX = bounds.x + bounds.w * (OVERLAY_ANCHOR.x + offset.dx);
  const bottomY =
    bounds.y +
    bounds.h * (OVERLAY_ANCHOR.y - OVERLAY_BOTTOM_MARGIN + offset.dy);

  return {
    x: Math.round(centerX - width / 2),
    y: Math.round(bottomY - height),
    width
  };
}
