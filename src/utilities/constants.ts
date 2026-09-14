/**
 * Distance from the overlay's bottom edge to the window's bottom edge, as a
 * share of the game height.
 *
 * Measured in two screenshots at 2560x1440: the XP bar starts at 97.9% of
 * the height, above it up to 94% is plain game area. 3% therefore leaves
 * about 13 pixels of air above the bar without touching it.
 *
 * Between the flask bar and the skill bar this strip is free, so the overlay
 * sits in the gap and not on the HUD.
 */
export const OVERLAY_BOTTOM_MARGIN = 0.03;

/**
 * Where the HUD ends at the top right, as a share of the game height.
 * Measured in two screenshots at 2560x1440: minimap down to 25.7%, info
 * panel with Tab held down to 19.8%. So the minimap is the taller case.
 *
 * 28% leaves air, because the info panel gets longer with many league
 * modifiers. A fixed share holds up here because Path of Exile has no UI
 * scaling: production_Config.ini only has minimap_zoom, and that changes the
 * map content, not the box size.
 */
export const OVERLAY_MINIMAP_TOP = 0.28;

/** Distance to the right edge of the game so the overlay does not stick to it. */
export const OVERLAY_SIDE_MARGIN = 0.005;

// Base width as a share of the game width, clamped afterwards.
export const OVERLAY_BASE_WIDTH = 0.26;
export const OVERLAY_MIN_WIDTH = 320;
export const OVERLAY_MAX_WIDTH = 560;

export const OVERLAY_MIN_HEIGHT = 120;

/**
 * Room for the header with act and remaining steps, in CSS pixels. The line
 * sits outside the flow so it does not shift the centring of the step.
 * Without reserved height it would run into long steps.
 */
export const OVERLAY_HEADER_HEIGHT = 20;

export const OVERLAY_SCALE_MIN = 0.6;
export const OVERLAY_SCALE_MAX = 2.0;
export const OVERLAY_SCALE_STEP = 0.1;

export const OVERLAY_BASE_FONT_SIZE = 16;

/**
 * The route of the overlay window, needed in three places: when creating the
 * window, when resolving it in the router and when determining a window's
 * role (see `window-role.ts`). Three separate strings would be three
 * opportunities to drift apart silently.
 */
export const OVERLAY_ROUTE = '/overlay';

export const OVERLAY_WINDOW_URL = `index.html/#${OVERLAY_ROUTE}`;
