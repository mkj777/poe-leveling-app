import { useEffect, useRef } from 'react';

import { reanchorEdge } from '@/utilities/route-progress';
import { syncRoute } from '@/services/route-sync';
import { tauriDeps } from '@/services/route-sync.tauri';
import { useRouteStore } from '@/store/route.store';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Upstream aktualisiert die Route vor allem in der ersten Woche einer neuen
// Liga mehrfach, danach sporadisch. Ein Check pro Tag deckt beides ab und
// kostet dank If-None-Match nichts (ADR-0001).
export function useRouteSync() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const run = async () => {
      const store = useRouteStore.getState();
      store.setSyncState('syncing');

      // Die Route wird nicht gespeichert, wohl aber die zuletzt betretene Zone.
      // Sie traegt den Fortschritt ueber Neustarts und Datenwechsel hinweg.
      const previousArea = store.currentAreaId;

      const result = await syncRoute(tauriDeps);

      if (result.route === null || result.sha === null) {
        store.setSyncState('error', result.error);
        return;
      }

      store.setRoute(result.route, result.sha);

      if (previousArea !== null) {
        store.setCurrentEdge(
          reanchorEdge(result.route.edges, previousArea, store.currentEdge)
        );
      }

      store.setSyncState('idle');
    };

    void run();
    const timer = setInterval(() => void run(), DAY_IN_MS);

    return () => clearInterval(timer);
  }, []);
}
