import type { GuideMode } from '@/utilities/guide-mode';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface States {
  mode: GuideMode;
  /** Zeitpunkt des vorletzten Starts, um die Pause davor zu messen. */
  lastOpenedAt: number | null;
}

interface Actions {
  setMode: (mode: GuideMode) => void;
  markOpened: (at: number) => void;
}

/**
 * Eigener Store statt eines Felds in settings.store: dessen Migration setzt
 * Groesse, Deckkraft und Verschiebung des Overlays zurueck, sobald die Version
 * steigt. Der Modus ist das nicht wert.
 *
 * Das Overlay ist ein eigenes Fenster, teilt sich aber den localStorage. Es
 * liest den Modus darum beim Aufbau von selbst richtig, ein Wechsel danach
 * kommt als GUIDE_MODE_EVENT.
 */
export const useGuideStore = create<States & Actions>()(
  persist(
    (set) => ({
      mode: 'league-start',
      lastOpenedAt: null,
      setMode: (mode) => set({ mode }),
      markOpened: (at) => set({ lastOpenedAt: at })
    }),
    { name: 'guide', version: 1 }
  )
);
