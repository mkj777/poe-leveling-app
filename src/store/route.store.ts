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
      // Aus der eigenen Route nachgeschlagen. Genau darum darf sie nur ein
      // Fenster speichern, siehe unten.
      currentAreaId: get().route?.edges[currentEdge] ?? null
    }),
  setSyncState: (syncState, syncError = null) => set({ syncState, syncError })
});

/**
 * Den Fortschritt speichert allein das Hauptfenster.
 *
 * Das Overlay ist Anzeige. Es bekommt Lesart und Kante gesagt (ADR-0011) und
 * haette hier nur eine zweite, konkurrierende Meinung abzulegen. Genau das ist
 * passiert: das Overlay hielt eine andere Lesart der Route, rechnete zur
 * gemeldeten Kante 172 eine andere Zone aus als das Hauptfenster, The Causeway
 * statt The Sarn Ramparts, und schrieb sie in denselben Eintrag. Beim naechsten
 * Start knuepfte das Hauptfenster daran an und stand zehn Kanten zurueck.
 *
 * Dass beide dieselbe Lesart halten, ist seit 0.98.0 zugesichert. Das hier ist
 * die zweite Haelfte: ohne Speicher kann das Overlay auch bei einem kuenftigen
 * Fehler keinen fremden Stand hinterlassen.
 *
 * Nur der Fortschritt wird gespeichert. Die Route selbst ist abgeleitet und
 * wird bei jedem Start in wenigen Millisekunden aus dem lokalen Cache neu
 * geparst.
 *
 * Sie zu speichern war ein Fehler: zustand stellt sie vor dem ersten Sync
 * wieder her, React rendert sie sofort, und der Renderer greift dann auf
 * Spieldaten zu, die setGameData noch nicht gesetzt hat. Ausserdem wuerde eine
 * gespeicherte Route aus einem alten Stand neben frischen Spieldaten stehen.
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
