import type { OverlayOffset } from '@/utilities/overlay-geometry';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface States {
  clientTxtPath: string;
  showLayout: boolean;
  overlayScale: number;
  overlayOffset: OverlayOffset;
}

interface Actions {
  setClientTxtPath: (clientTxtPath: string) => void;
  setShowLayout: (showLayout: boolean) => void;
  setOverlayScale: (overlayScale: number) => void;
  setOverlayOffset: (overlayOffset: OverlayOffset) => void;
  resetOverlayPlacement: () => void;
}

export const useSettingsStore = create<States & Actions>()(
  persist(
    (set) => ({
      clientTxtPath: '',
      showLayout: true,
      overlayScale: 1,
      overlayOffset: { dx: 0, dy: 0 },
      setClientTxtPath: (clientTxtPath) => set({ clientTxtPath }),
      setShowLayout: (showLayout) => set({ showLayout }),
      setOverlayScale: (overlayScale) => set({ overlayScale }),
      setOverlayOffset: (overlayOffset) => set({ overlayOffset }),
      resetOverlayPlacement: () =>
        set({ overlayScale: 1, overlayOffset: { dx: 0, dy: 0 } })
    }),
    {
      name: 'settings',
      version: 2,
      migrate: (persisted) => {
        // Version 1 hielt displayPosition in absoluten Bildschirmpixeln und
        // growDirection. Beides ist nach Fenster-, Aufloesungs- oder
        // Monitorwechsel falsch und wird darum verworfen statt uebernommen.
        // Anker plus relativer Offset ersetzen es (ADR-0006).
        const old = persisted as Partial<States> | undefined;
        return {
          clientTxtPath: old?.clientTxtPath ?? '',
          showLayout: old?.showLayout ?? true,
          overlayScale: 1,
          overlayOffset: { dx: 0, dy: 0 }
        } as States & Actions;
      }
    }
  )
);
