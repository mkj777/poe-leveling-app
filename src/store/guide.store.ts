import type { GuideMode } from '@/utilities/guide-mode';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface States {
  mode: GuideMode;
  /** Time of the previous start, to measure the pause before this one. */
  lastOpenedAt: number | null;
}

interface Actions {
  setMode: (mode: GuideMode) => void;
  markOpened: (at: number) => void;
}

/**
 * A store of its own instead of a field in settings.store: that store's
 * migration resets size, opacity and offset of the overlay as soon as the
 * version goes up. The mode is not worth that.
 *
 * The overlay is its own window but shares the localStorage. It therefore
 * reads the mode correctly on its own at startup; a switch after that comes
 * as GUIDE_MODE_EVENT.
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
