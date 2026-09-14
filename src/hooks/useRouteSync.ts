import { useEffect, useRef } from 'react';

import type { GuideMode } from '@/utilities/guide-mode';
import { loadRoute, syncRoute } from '@/services/route-sync';
import { reanchorEdge } from '@/utilities/route-progress';
import { tauriDeps } from '@/services/route-sync.tauri';
import { useGuideStore } from '@/store/guide.store';
import { useRouteStore } from '@/store/route.store';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Upstream updates the route several times mainly in the first week of a new
// league, sporadically after that. One check per day covers both and costs
// nothing thanks to If-None-Match (ADR-0001).
export function useRouteSync() {
  const mode = useGuideStore((state) => state.mode);

  // Records which mode has already been parsed for. A mode switch needs a
  // new run, the double mount under StrictMode does not.
  const parsedFor = useRef<GuideMode | null>(null);

  useEffect(() => {
    const first = parsedFor.current === null;
    const changed = parsedFor.current !== mode;
    parsedFor.current = mode;

    const run = async (withUpstream: boolean) => {
      const store = useRouteStore.getState();
      store.setSyncState('syncing');

      // The route is not persisted, but the last entered zone is. It carries
      // progress across restarts, data changes and the mode switch, in which
      // the edge list gets a different length.
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
        // Read fresh, not from the snapshot above: between the start of the
        // sync and here lies a network access, during which the Client.txt
        // tick may have advanced progress.
        const currentEdge = useRouteStore.getState().currentEdge;

        store.setCurrentEdge(
          reanchorEdge(result.route.edges, previousArea, currentEdge)
        );
      }

      store.setSyncState('idle');
    };

    // The first run asks upstream, a mode switch does not: the data is the
    // same, only the mode differs. The switch used to go through the sync as
    // well and so took as long as a request to GitHub, for which reqwest sets
    // no time limit.
    //
    // The second mount under StrictMode must not repeat the network access,
    // but it must re-arm the timer: the cleanup of the first has just cleared
    // it.
    if (changed) void run(first);

    const timer = setInterval(() => void run(true), DAY_IN_MS);

    return () => clearInterval(timer);
  }, [mode]);
}
