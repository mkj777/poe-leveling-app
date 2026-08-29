import { OVERLAY_ROUTE } from './constants';

/**
 * Overlay und Hauptfenster teilen sich ein Bündel und unterscheiden sich nur
 * durch die Route im Hash. Manches darf trotzdem nur eines von beiden tun.
 *
 * Bewusst über den Hash und nicht über die Fenster-Kennung von Tauri: die
 * Stores sollen ohne Tauri im Node-Lauf ladbar bleiben, wie route-sync.ts
 * auch. Dass Hash und Fenster-URL zusammenpassen, hält ein Test fest.
 */
export function isOverlayPath(hash: string): boolean {
  return hash.replace(/^#/, '').startsWith(OVERLAY_ROUTE);
}

/** Im Node-Testlauf gibt es kein `location`, dort ist nichts das Overlay. */
export function isOverlayWindow(): boolean {
  return typeof location === 'undefined' ? false : isOverlayPath(location.hash);
}
