import type { StateCreator, StoreApi, UseBoundStore } from 'zustand';
import type { RouteData } from '@/lib/exile-leveling';
import { create } from 'zustand';
import { isOverlayWindow } from '@/utilities/window-role';
import { persist } from 'zustand/middleware';

export type SyncState = 'idle' | 'syncing' | 'error';

interface States {
  route: RouteData.Route | null;
  sha: string | null;
  currentEdge: number;
  /** Zone of the current edge, to re-anchor progress after a restart or a
   *  data change. */
  currentAreaId: string | null;
  syncState: SyncState;
  syncError: string | null;
}

interface Actions {
  setRoute: (route: RouteData.Route, sha: string) => void;
  setCurrentEdge: (currentEdge: number) => void;
  setSyncState: (syncState: SyncState, syncError?: string | null) => void;
}

type RouteStore = States & Actions;

const createState: StateCreator<RouteStore> = (set, get) => ({
  route: null,
  sha: null,
  currentEdge: 0,
  currentAreaId: null,
  syncState: 'idle',
  syncError: null,
  setRoute: (route, sha) => set({ route, sha }),
  setCurrentEdge: (currentEdge) =>
    set({
      currentEdge,
      // Looked up in the window's own route. Exactly why only one window
      // may persist it, see below.
      currentAreaId: get().route?.edges[currentEdge] ?? null
    }),
  setSyncState: (syncState, syncError = null) => set({ syncState, syncError })
});

/**
 * Only the main window persists progress.
 *
 * The overlay is a display. It is told mode and edge (ADR-0011) and would only
 * have a second, competing opinion to store here. Exactly that happened: the
 * overlay held a different mode of the route, computed a different zone for
 * the reported edge 172 than the main window, The Causeway instead of The
 * Sarn Ramparts, and wrote it into the same entry. On the next start the main
 * window re-anchored on it and stood ten edges back.
 *
 * That both hold the same mode has been guaranteed since 0.98.0. This is the
 * second half: without storage the overlay cannot leave a foreign state
 * behind even on a future bug.
 *
 * Only progress is persisted. The route itself is derived and is re-parsed
 * from the local cache in a few milliseconds on every start.
 *
 * Persisting it was a mistake: zustand restores it before the first sync,
 * React renders it immediately, and the renderer then accesses game data that
 * setGameData has not set yet. A persisted route from an old version would
 * also sit next to fresh game data.
 */
export const useRouteStore: UseBoundStore<StoreApi<RouteStore>> =
  isOverlayWindow()
    ? create<RouteStore>()(createState)
    : create<RouteStore>()(
        persist(createState, {
          name: 'route',
          version: 2,
          partialize: (state) => ({
            currentEdge: state.currentEdge,
            currentAreaId: state.currentAreaId
          })
        })
      );
