// Anker im Spiel-Rect: horizontal mittig, vertikal am unteren Rand (ADR-0006).
export const OVERLAY_ANCHOR = { x: 0.5, y: 1.0 };

// Abstand der Overlay-Unterkante zur Fensterunterkante, Anteil der Spielhoehe.
// Haelt das Overlay ueber Flask- und Skillbar frei.
export const OVERLAY_BOTTOM_MARGIN = 0.16;

// Grundbreite als Anteil der Spielbreite, danach geklemmt.
export const OVERLAY_BASE_WIDTH = 0.26;
export const OVERLAY_MIN_WIDTH = 320;
export const OVERLAY_MAX_WIDTH = 560;

export const OVERLAY_MIN_HEIGHT = 120;

export const OVERLAY_SCALE_MIN = 0.6;
export const OVERLAY_SCALE_MAX = 2.0;
export const OVERLAY_SCALE_STEP = 0.1;

export const OVERLAY_BASE_FONT_SIZE = 16;

// Uebergangsweise, solange main.page.tsx noch selbst positioniert.
// Faellt mit Task 10 weg.
export const IN_GAME_WINDOW_SIZE = {
  width: 480,
  height: 120
};
