/**
 * Abstand der Overlay-Unterkante zur Fensterunterkante, Anteil der Spielhoehe.
 *
 * In zwei Screenshots bei 2560x1440 gemessen: die XP-Leiste beginnt bei 97,9 %
 * der Hoehe, darueber ist bis 94 % nur Spielflaeche. 3 % lassen also rund
 * 13 Pixel Luft ueber der Leiste, ohne sie zu beruehren.
 *
 * Zwischen Flaschen- und Skillleiste ist dieser Streifen frei, das Overlay
 * sitzt darum in der Luecke und nicht auf der HUD.
 */
export const OVERLAY_BOTTOM_MARGIN = 0.03;

/**
 * Wo die HUD rechts oben endet, als Anteil der Spielhoehe. In zwei
 * Screenshots bei 2560x1440 gemessen: Minimap bis 25,7 %, Infotafel bei
 * gedruecktem Tab bis 19,8 %. Die Minimap ist also der hoehere Fall.
 *
 * 28 % laesst Luft, weil die Infotafel mit vielen Liga-Modifikatoren laenger
 * wird. Ein fester Anteil traegt hier, weil Path of Exile keine
 * UI-Skalierung kennt: production_Config.ini hat nur minimap_zoom, und das
 * aendert den Karteninhalt, nicht die Boxgroesse.
 */
export const OVERLAY_MINIMAP_TOP = 0.28;

/** Abstand zum rechten Spielrand, damit das Overlay nicht anklebt. */
export const OVERLAY_SIDE_MARGIN = 0.005;

// Grundbreite als Anteil der Spielbreite, danach geklemmt.
export const OVERLAY_BASE_WIDTH = 0.26;
export const OVERLAY_MIN_WIDTH = 320;
export const OVERLAY_MAX_WIDTH = 560;

export const OVERLAY_MIN_HEIGHT = 120;

/**
 * Platz fuer die Kopfzeile mit Akt und Restschritten, in CSS-Pixeln. Die Zeile
 * steht ausserhalb des Flusses, damit sie die Zentrierung des Schritts nicht
 * verschiebt. Ohne reservierte Hoehe liefe sie bei langen Schritten hinein.
 */
export const OVERLAY_HEADER_HEIGHT = 20;

export const OVERLAY_SCALE_MIN = 0.6;
export const OVERLAY_SCALE_MAX = 2.0;
export const OVERLAY_SCALE_STEP = 0.1;

export const OVERLAY_BASE_FONT_SIZE = 16;

/**
 * Die Route des Overlay-Fensters, an drei Stellen gebraucht: beim Anlegen des
 * Fensters, beim Aufloesen im Router und beim Bestimmen der Rolle eines
 * Fensters (siehe `window-role.ts`). Drei getrennte Zeichenketten waeren drei
 * Gelegenheiten, still auseinanderzulaufen.
 */
export const OVERLAY_ROUTE = '/overlay';

export const OVERLAY_WINDOW_URL = `index.html/#${OVERLAY_ROUTE}`;
