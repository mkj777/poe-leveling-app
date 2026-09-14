import { OVERLAY_ROUTE } from './constants';

/**
 * Overlay and main window share one bundle and differ only by the route in
 * the hash. Some things may nevertheless be done by only one of them.
 *
 * Deliberately via the hash and not via Tauri's window label: the stores
 * should remain loadable without Tauri in the Node run, like route-sync.ts.
 * A test pins that hash and window URL fit together.
 */
export function isOverlayPath(hash: string): boolean {
  return hash.replace(/^#/, '').startsWith(OVERLAY_ROUTE);
}

/** The Node test run has no `location`; nothing is the overlay there. */
export function isOverlayWindow(): boolean {
  return typeof location === 'undefined' ? false : isOverlayPath(location.hash);
}
