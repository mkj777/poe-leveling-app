import type {
  OverlayAnchor,
  OverlayOffset
} from '@/utilities/overlay-geometry';
import type { StateCreator, StoreApi, UseBoundStore } from 'zustand';
import { create } from 'zustand';
import { isOverlayWindow } from '@/utilities/window-role';
import { persist } from 'zustand/middleware';

interface States {
  clientTxtPath: string;
  overlayScale: number;
  overlayOffset: OverlayOffset;
  /** Opacity of the overlay surface, 0 is fully transparent. */
  overlayOpacity: number;
  overlayAnchor: OverlayAnchor;
}

interface Actions {
  setClientTxtPath: (clientTxtPath: string) => void;
  setOverlayScale: (overlayScale: number) => void;
  setOverlayOffset: (overlayOffset: OverlayOffset) => void;
  setOverlayOpacity: (overlayOpacity: number) => void;
  setOverlayAnchor: (overlayAnchor: OverlayAnchor) => void;
  resetOverlayPlacement: () => void;
}

type SettingsStore = States & Actions;

const createState: StateCreator<SettingsStore> = (set) => ({
  clientTxtPath: '',
  overlayScale: 1,
  overlayOffset: { dx: 0, dy: 0 },
  overlayOpacity: 0.35,
  overlayAnchor: 'bottom',
  setClientTxtPath: (clientTxtPath) => set({ clientTxtPath }),
  setOverlayScale: (overlayScale) => set({ overlayScale }),
  setOverlayOffset: (overlayOffset) => set({ overlayOffset }),
  setOverlayOpacity: (overlayOpacity) => set({ overlayOpacity }),
  setOverlayAnchor: (overlayAnchor) => set({ overlayAnchor }),
  resetOverlayPlacement: () =>
    set({ overlayScale: 1, overlayOffset: { dx: 0, dy: 0 } })
});

/**
 * Persisted only in the main window, which owns the settings. The overlay
 * gets them sent and holds them in memory so it can draw. Dragging it to a
 * new place used to write in here, the main window knew nothing about it, and
 * the next slider there silently reset the offset (ADR-0012).
 */
export const useSettingsStore: UseBoundStore<StoreApi<SettingsStore>> =
  isOverlayWindow()
    ? create<SettingsStore>()(createState)
    : create<SettingsStore>()(
        persist(createState, {
          name: 'settings',
          version: 4,
          migrate: (persisted) => {
            // Version 1 held displayPosition in absolute screen pixels and
            // growDirection. Both are wrong after a window, resolution or
            // monitor change and are therefore discarded instead of carried
            // over. Anchor plus relative offset replace them (ADR-0006).
            //
            // Version 2 could contain a runaway offset, because the drag
            // handler reacted to its own setPosition calls. That one is
            // discarded too instead of dragged along.
            //
            // Version 3 had the anchor below the minimap as the default. The
            // overlay is often in the way there; the default is now at the
            // bottom just above the XP bar. The path is kept.
            //
            // The showLayout switch went away with the layout window. The
            // version nevertheless stays at 4: bumping it would trigger the
            // migration again and reset size, opacity and offset of the
            // overlay to their defaults. A leftover entry in storage bothers
            // nobody, nothing reads it any more.
            const old = persisted as Partial<States> | undefined;
            return {
              clientTxtPath: old?.clientTxtPath ?? '',
              overlayScale: 1,
              overlayOffset: { dx: 0, dy: 0 },
              overlayOpacity: 0.35,
              overlayAnchor: 'bottom'
            } as SettingsStore;
          }
        })
      );
