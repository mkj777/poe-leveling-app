import { LogicalPosition, LogicalSize, appWindow } from '@tauri-apps/api/window';
import {
  OVERLAY_BASE_FONT_SIZE,
  OVERLAY_MIN_HEIGHT
} from '@/utilities/constants';
import { useEffect, useRef, useState } from 'react';

import type { PoeBounds } from '@/utilities/overlay-geometry';
import { computeOverlayRect } from '@/utilities/overlay-geometry';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore } from '@/store/settings.store';

// Koppelt das Overlay an das Spielfenster. Das Backend meldet Bounds nur bei
// Aenderung, die Geometrie rechnet computeOverlayRect (ADR-0005, ADR-0006).
export function usePoeWindow(active: boolean, contentHeight: number) {
  const [bounds, setBounds] = useState<PoeBounds | null>(null);
  const started = useRef(false);
  const overlayScale = useSettingsStore((state) => state.overlayScale);
  const overlayOffset = useSettingsStore((state) => state.overlayOffset);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void invoke('start_poe_tracking');

    const unlisten = listen<PoeBounds>('poe-bounds', (event) => {
      setBounds(event.payload);
    });

    return () => {
      void unlisten.then((off) => off());
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

    void (async () => {
      await appWindow.setSize(new LogicalSize(rect.width, height));
      await appWindow.setPosition(new LogicalPosition(rect.x, rect.y));

      // Nur zeigen, solange das Spiel im Vordergrund ist, sonst liegt das
      // Overlay ueber anderen Fenstern.
      if (bounds.focused) {
        await appWindow.show();
      } else {
        await appWindow.hide();
      }
    })();
  }, [active, bounds, contentHeight, overlayScale, overlayOffset]);

  return { bounds };
}
