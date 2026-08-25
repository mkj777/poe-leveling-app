import { LogicalPosition, LogicalSize, appWindow } from '@tauri-apps/api/window';
import {
  OVERLAY_BASE_FONT_SIZE,
  OVERLAY_MIN_HEIGHT
} from '@/utilities/constants';
import { useEffect, useState } from 'react';

import type { PoeBounds } from '@/utilities/overlay-geometry';
import { computeOverlayRect } from '@/utilities/overlay-geometry';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore } from '@/store/settings.store';

// Koppelt das Overlay an das Spielfenster. Das Backend meldet Bounds nur bei
// Aenderung, die Geometrie rechnet computeOverlayRect (ADR-0005, ADR-0006).
export function usePoeWindow(active: boolean, contentHeight: number) {
  const [bounds, setBounds] = useState<PoeBounds | null>(null);
  const overlayScale = useSettingsStore((state) => state.overlayScale);
  const overlayOffset = useSettingsStore((state) => state.overlayOffset);

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

    const height = Math.max(contentHeight, OVERLAY_MIN_HEIGHT);
    const rect = computeOverlayRect(bounds, height, overlayScale, overlayOffset);

    // Das Overlay bleibt sichtbar, auch wenn das Spiel den Fokus verliert.
    // Bei Fokusverlust zu verstecken klingt sauber, macht die App aber
    // unauffindbar: wer Start drueckt, hat gerade die App im Vordergrund und
    // nicht das Spiel, das Fenster verschwindet also im selben Moment.
    void (async () => {
      await appWindow.setSize(new LogicalSize(rect.width, height));
      await appWindow.setPosition(new LogicalPosition(rect.x, rect.y));
    })();
  }, [active, bounds, contentHeight, overlayScale, overlayOffset]);

  return { bounds };
}
