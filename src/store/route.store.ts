import type { RouteData } from '@/lib/exile-leveling';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SyncState = 'idle' | 'syncing' | 'error';

interface States {
  route: RouteData.Route | null;
  sha: string | null;
  currentEdge: number;
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
    (set) => ({
      route: null,
      sha: null,
      currentEdge: 0,
      syncState: 'idle',
      syncError: null,
      setRoute: (route, sha) => set({ route, sha }),
      setCurrentEdge: (currentEdge) => set({ currentEdge }),
      setSyncState: (syncState, syncError = null) =>
        set({ syncState, syncError })
    }),
    {
      name: 'route',
      version: 1,
      // syncState und syncError sind Laufzeitzustand und gehoeren nicht in den
      // Speicher, sonst startet die App im Zustand des letzten Fehlers.
      partialize: (state) => ({
        route: state.route,
        sha: state.sha,
        currentEdge: state.currentEdge
      })
    }
  )
);
