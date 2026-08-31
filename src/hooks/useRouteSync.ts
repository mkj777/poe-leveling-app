import { useEffect, useRef } from 'react';

import type { GuideMode } from '@/utilities/guide-mode';
import { loadRoute, syncRoute } from '@/services/route-sync';
import { reanchorEdge } from '@/utilities/route-progress';
import { tauriDeps } from '@/services/route-sync.tauri';
import { useGuideStore } from '@/store/guide.store';
import { useRouteStore } from '@/store/route.store';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Upstream aktualisiert die Route vor allem in der ersten Woche einer neuen
// Liga mehrfach, danach sporadisch. Ein Check pro Tag deckt beides ab und
// kostet dank If-None-Match nichts (ADR-0001).
export function useRouteSync() {
  const mode = useGuideStore((state) => state.mode);

  // Haelt fest, fuer welchen Modus schon geparst wurde. Ein Moduswechsel
  // braucht einen neuen Durchlauf, der Doppelmount unter StrictMode nicht.
  const parsedFor = useRef<GuideMode | null>(null);

  useEffect(() => {
    const first = parsedFor.current === null;
    const changed = parsedFor.current !== mode;
    parsedFor.current = mode;

    const run = async (withUpstream: boolean) => {
      const store = useRouteStore.getState();
      store.setSyncState('syncing');

      // Die Route wird nicht gespeichert, wohl aber die zuletzt betretene Zone.
      // Sie traegt den Fortschritt ueber Neustarts, Datenwechsel und den
      // Moduswechsel hinweg, in dem die Kantenliste eine andere Laenge bekommt.
      const previousArea = store.currentAreaId;

      const result = withUpstream
        ? await syncRoute(tauriDeps, mode)
        : await loadRoute(tauriDeps, mode);

      if (result.route === null || result.sha === null) {
        store.setSyncState('error', result.error);
        return;
      }

      store.setRoute(result.route, result.sha);

      if (previousArea !== null) {
        // Frisch gelesen, nicht aus dem Schnappschuss von oben: zwischen dem
        // Start des Abgleichs und hier liegt ein Netzzugriff, in dem der
        // Client.txt-Takt den Fortschritt weitergestellt haben kann.
        const currentEdge = useRouteStore.getState().currentEdge;

        store.setCurrentEdge(
          reanchorEdge(result.route.edges, previousArea, currentEdge)
        );
      }

      store.setSyncState('idle');
    };

    // Der erste Lauf fragt Upstream, ein Moduswechsel nicht: die Daten sind
    // dieselben, nur die Lesart ist eine andere. Frueher lief auch der Wechsel
    // durch den Abgleich und dauerte damit so lange wie ein Request an GitHub,
    // fuer den reqwest keine Zeitgrenze setzt.
    //
    // Der zweite Mount unter StrictMode soll den Netzzugriff nicht wiederholen,
    // den Takt aber sehr wohl neu setzen: das Cleanup des ersten hat ihn
    // gerade abgeraeumt.
    if (changed) void run(first);

    const timer = setInterval(() => void run(true), DAY_IN_MS);

    return () => clearInterval(timer);
  }, [mode]);
}
