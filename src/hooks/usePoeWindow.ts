import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  OVERLAY_BASE_FONT_SIZE,
  OVERLAY_MIN_HEIGHT
} from '@/utilities/constants';
import { useEffect, useRef, useState } from 'react';

import type { PoeBounds } from '@/utilities/overlay-geometry';
import { computeOverlayRect, offsetFromWindow } from '@/utilities/overlay-geometry';
import type { OverlayPlacement } from '@/utilities/overlay-view';
import { OVERLAY_PLACEMENT_EVENT } from '@/utilities/overlay-view';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { useSettingsStore } from '@/store/settings.store';
const appWindow = getCurrentWebviewWindow()

// Attaches the overlay to the game window. The backend reports bounds only on
// change, the geometry is computed by computeOverlayRect (ADR-0005, ADR-0006).
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

  // What we set ourselves. Without this the drag handler takes our own
  // setPosition calls for user input and ratchets the offset up until the
  // overlay runs off screen.
  const lastSet = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // No guard on the listener. Under StrictMode the effect runs twice; a
    // guard would bail out on the second run after the cleanup of the first
    // has already removed the listener. Then no event ever arrives.
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

      // Tracking is idempotent on the Rust side.
      await invoke('start_poe_tracking');

      // Ask once actively: the first event may have fired before the
      // listener was up.
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
      // The bounds from GetWindowRect are physical pixels, the measured
      // content height is CSS pixels. Without the factor the overlay sits
      // wrong on every scaled screen.
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

    // When dragging, store the new placement as a fraction of the game rect,
    // not as pixels. Otherwise it is off after a resolution change.
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

      const offset = offsetFromWindow(
        bounds,
        {
          x: payload.x,
          y: payload.y,
          width: size.width,
          height: size.height
        },
        overlayAnchor
      );

      // Set here so the window follows immediately, and report to the main
      // window, which stores the settings (ADR-0012).
      setOverlayOffset(offset);
      void emit(OVERLAY_PLACEMENT_EVENT, {
        overlayScale,
        overlayOffset: offset
      } satisfies OverlayPlacement);
    });

    return () => {
      void unlisten.then((off) => off());
    };
  }, [editMode, bounds, setOverlayOffset, overlayAnchor, overlayScale]);

  return { bounds };
}
