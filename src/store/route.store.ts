import type { RouteData } from '@/lib/exile-leveling';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SyncState = 'idle' | 'syncing' | 'error';

interface States {
  route: RouteData.Route | null;
  sha: string | null;
  currentEdge: number;
  /** Zone der aktuellen Kante, um den Fortschritt nach einem Neustart oder
   *  einem Datenwechsel wieder anzuknuepfen. */
  currentAreaId: string | null;
  syncState: SyncState;
  syncError: string | null;
}

interface Actions {
  setRoute: (route: RouteData.Route, sha: string) => void;
  setCurrentEdge: (currentEdge: number) => void;
  setSyncState: (syncState: SyncState, syncError?: string | null) => void;
}

export const useRouteStore = create<States & Actions>()(
  persist(
    (set, get) => ({
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
          currentAreaId: get().route?.edges[currentEdge] ?? null
        }),
      setSyncState: (syncState, syncError = null) =>
        set({ syncState, syncError })
    }),
    {
      name: 'route',
      version: 2,
      /**
       * Nur der Fortschritt wird gespeichert. Die Route selbst ist abgeleitet
       * und wird bei jedem Start in wenigen Millisekunden aus dem lokalen Cache
       * neu geparst.
       *
       * Sie zu speichern war ein Fehler: zustand stellt sie vor dem ersten Sync
       * wieder her, React rendert sie sofort, und der Renderer greift dann auf
       * Spieldaten zu, die setGameData noch nicht gesetzt hat. Ausserdem wuerde
       * eine gespeicherte Route aus einem alten Stand neben frischen Spieldaten
       * stehen.
       */
      partialize: (state) => ({
        currentEdge: state.currentEdge,
        currentAreaId: state.currentAreaId
      })
    }
  )
);
