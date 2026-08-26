import type {
  OverlayAnchor,
  OverlayOffset
} from '@/utilities/overlay-geometry';

import { emit } from '@tauri-apps/api/event';

export const OVERLAY_SETTINGS_EVENT = 'overlay-settings';

/**
 * Das Overlay ist ein eigenes Fenster und damit ein eigener Store. Was man in
 * den Einstellungen des Hauptfensters zieht, muss ihm also gesagt werden.
 */
export interface OverlaySettings {
  overlayScale: number;
  overlayOpacity: number;
  overlayOffset: OverlayOffset;
  overlayAnchor: OverlayAnchor;
}

export function publishOverlaySettings(settings: OverlaySettings) {
  void emit(OVERLAY_SETTINGS_EVENT, {
    overlayScale: settings.overlayScale,
    overlayOpacity: settings.overlayOpacity,
    overlayOffset: settings.overlayOffset,
    overlayAnchor: settings.overlayAnchor
  });
}
