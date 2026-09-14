import {
  OVERLAY_BASE_WIDTH,
  OVERLAY_BOTTOM_MARGIN,
  OVERLAY_MAX_WIDTH,
  OVERLAY_MIN_WIDTH,
  OVERLAY_MINIMAP_TOP,
  OVERLAY_SIDE_MARGIN
} from './constants';

// Payload of the poe-bounds event from src-tauri/src/overlay.rs.
export interface PoeBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  focused: boolean;
  exclusiveFullscreen: boolean;
  found: boolean;
}

// Fine adjustment as a fraction of the game rect, not in pixels. Only then
// does it survive resolution and monitor changes (ADR-0006).
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
 * An anchor has two parts: where in the game window it sits, and with which
 * of its own corners the overlay hangs on it. The latter determines which way
 * the window grows when the text gets longer.
 */
const ANCHORS: Record<
  OverlayAnchor,
  { point: { x: number; y: number }; pin: { x: number; y: number } }
> = {
  // Below the minimap: right-aligned, grows downwards.
  minimap: {
    point: { x: 1 - OVERLAY_SIDE_MARGIN, y: OVERLAY_MINIMAP_TOP },
    pin: { x: 1, y: 0 }
  },
  // Bottom centre: grows upwards, the bottom edge stays above the HUD row.
  bottom: {
    point: { x: 0.5, y: 1 - OVERLAY_BOTTOM_MARGIN },
    pin: { x: 0.5, y: 1 }
  }
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function overlayWidth(bounds: PoeBounds, scale: number): number {
  // The clamp keeps the base width in a usable range regardless of the game
  // resolution. It must not act on the scaled result though: otherwise, past
  // a certain factor, only the font grows while the window stays put and the
  // text inside wraps.
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
 * The inverse: compute the relative offset back from a window position the
 * user dragged to. Must be exactly inverse to computeOverlayRect, otherwise
 * the overlay wanders a bit further on every cycle.
 */
export function offsetFromWindow(
  bounds: PoeBounds,
  window: { x: number; y: number; width: number; height: number },
  anchor: OverlayAnchor
): OverlayOffset {
  // Without a game window there is no reference to derive a relative offset
  // from. The division would yield Infinity, and the value gets persisted:
  // the overlay would be displaced permanently afterwards.
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
