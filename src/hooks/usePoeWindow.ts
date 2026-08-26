import {
  PhysicalPosition,
  PhysicalSize,
  appWindow
} from '@tauri-apps/api/window';
import {
  OVERLAY_BASE_FONT_SIZE,
  OVERLAY_MIN_HEIGHT
} from '@/utilities/constants';
import { useEffect, useRef, useState } from 'react';

import type { PoeBounds } from '@/utilities/overlay-geometry';
import { computeOverlayRect, offsetFromWindow } from '@/utilities/overlay-geometry';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore } from '@/store/settings.store';

// Koppelt das Overlay an das Spielfenster. Das Backend meldet Bounds nur bei
// Aenderung, die Geometrie rechnet computeOverlayRect (ADR-0005, ADR-0006).
export function usePoeWindow(
  active: boolean,
  contentHeight: number,
  editMode = false
) {
  const [bounds, setBounds] = useState<PoeBounds | null>(null);
  const overlayScale = useSettingsStore((state) => state.overlayScale);
  const overlayOffset = useSettingsStore((state) => state.overlayOffset);
  const overlayAnchor = useSettingsStore((state) => state.overlayAnchor);
  const setOverlayOffset = useSettingsStore((state) => state.setOverlayOffset);

  // Was wir selbst gesetzt haben. Ohne das haelt der Drag-Handler unsere
  // eigenen setPosition-Aufrufe fuer Nutzereingaben und schaukelt den Offset
  // hoch, bis das Overlay aus dem Bild laeuft.
  const lastSet = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Kein Riegel auf den Listener. Unter StrictMode laeuft der Effekt doppelt,
    // ein Riegel wuerde beim zweiten Lauf aussteigen, nachdem das Cleanup des
    // ersten den Listener schon abgemeldet hat. Dann kommt nie ein Ereignis an.
    let disposed = false;
    let off: (() => void) | undefined;

    void (async () => {
      const unlisten = await listen<PoeBounds>('poe-bounds', (event) => {
        setBounds(event.payload);
      });

      if (disposed) {
        unlisten();
        return;
      }
      off = unlisten;

      // Das Tracking ist auf der Rust-Seite idempotent.
      await invoke('start_poe_tracking');

      // Einmal aktiv nachfragen: das erste Ereignis kann gefeuert haben, bevor
      // der Listener stand.
      setBounds(await invoke<PoeBounds>('poe_bounds'));
    })();

    return () => {
      disposed = true;
      off?.();
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${
      OVERLAY_BASE_FONT_SIZE * overlayScale
    }px`;
  }, [overlayScale]);

  useEffect(() => {
    if (!active || bounds === null || !bounds.found) return;

    let cancelled = false;

    void (async () => {
      // Die Bounds aus GetWindowRect sind physische Pixel, die gemessene
      // Inhaltshoehe sind CSS-Pixel. Ohne den Faktor sitzt das Overlay auf
      // jedem skalierten Bildschirm falsch.
      const scale = await appWindow.scaleFactor();
      const height = Math.round(
        Math.max(contentHeight, OVERLAY_MIN_HEIGHT) * scale
      );
      const rect = computeOverlayRect(
        bounds,
        height,
        overlayScale,
        overlayOffset,
        overlayAnchor
      );

      if (cancelled) return;

      lastSet.current = { x: rect.x, y: rect.y };
      await appWindow.setSize(new PhysicalSize(rect.width, height));
      await appWindow.setPosition(new PhysicalPosition(rect.x, rect.y));
    })();

    return () => {
      cancelled = true;
    };
  }, [active, bounds, contentHeight, overlayScale, overlayOffset, overlayAnchor]);

  useEffect(() => {
    void appWindow.setIgnoreCursorEvents(active && !editMode);
  }, [active, editMode]);

  useEffect(() => {
    if (!editMode) return;

    // Beim Ziehen die neue Lage als Bruchteil des Spiel-Rects zuruecklegen,
    // nicht als Pixel. Sonst stimmt sie nach Aufloesungswechsel nicht mehr.
    const unlisten = appWindow.onMoved(async ({ payload }) => {
      if (bounds === null || !bounds.found) return;

      const self = lastSet.current;
      if (
        self !== null &&
        Math.abs(payload.x - self.x) < 2 &&
        Math.abs(payload.y - self.y) < 2
      ) {
        return;
      }

      const size = await appWindow.outerSize();

      setOverlayOffset(
        offsetFromWindow(
          bounds,
          {
            x: payload.x,
            y: payload.y,
            width: size.width,
            height: size.height
          },
          overlayAnchor
        )
      );
    });

    return () => {
      void unlisten.then((off) => off());
    };
  }, [editMode, bounds, setOverlayOffset, overlayAnchor]);

  return { bounds };
}
