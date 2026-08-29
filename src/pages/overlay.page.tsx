import { useEffect, useState } from 'react';

import InGameScreen from '@/components/in-game-screen';
import {
  OVERLAY_HEADER_HEIGHT,
  OVERLAY_MIN_HEIGHT
} from '@/utilities/constants';
import type { GuideMode, GuideState } from '@/utilities/guide-mode';
import type { OverlaySettings } from '@/services/overlay-settings';
import { GUIDE_STATE_EVENT, OVERLAY_READY_EVENT } from '@/utilities/guide-mode';
import { OVERLAY_SETTINGS_EVENT } from '@/services/overlay-settings';
import { emit, listen } from '@tauri-apps/api/event';
import { loadRouteFromCache } from '@/services/route-sync.tauri';
import { usePoeWindow } from '@/hooks/usePoeWindow';
import { useRouteStore } from '@/store/route.store';
import { useSettingsStore } from '@/store/settings.store';

// Modulweit, weil das Fenster genau eine Route haelt. Zeigt an, in welcher
// Lesart sie geparst wurde, damit ein Kantenindex nur auf die Route trifft,
// zu der er gehoert.
let loadedMode: GuideMode | null = null;

// Meldungen werden nacheinander abgearbeitet. Kommen Moduswechsel und
// Kantenwechsel dicht hintereinander, duerfen ihre Ladevorgaenge sich nicht
// ueberholen und die Route des jeweils anderen setzen.
let queue: Promise<void> = Promise.resolve();

async function applyState(state: GuideState) {
  if (loadedMode !== state.mode) {
    const loaded = await loadRouteFromCache(state.mode);
    // Ohne Route auch keine Kante: ein Index auf der alten Lesart waere
    // schlimmer als gar keine Anzeige.
    if (loaded === null) return;

    loadedMode = state.mode;
    useRouteStore.getState().setRoute(loaded.route, loaded.sha);
  }

  // Erst nach der Route: setCurrentEdge schlaegt die Zone darin nach.
  useRouteStore.getState().setCurrentEdge(state.currentEdge);
}

/**
 * Eigenes Fenster, damit das Hauptfenster Hauptfenster bleiben kann. Die Route
 * parst es selbst aus dem lokalen Cache, welche Lesart und welche Kante sagt
 * ihm das Hauptfenster.
 */
export default function OverlayPage() {
  const [contentHeight, setContentHeight] = useState(OVERLAY_MIN_HEIGHT);
  const [editMode, setEditMode] = useState(false);

  const route = useRouteStore((state) => state.route);
  const currentEdge = useRouteStore((state) => state.currentEdge);

  usePoeWindow(true, contentHeight, editMode);

  // Das Fenster ist transparent, der Rumpf darf also weder Hintergrund noch
  // Rahmen mitbringen. Die Flaeche macht erst die Karte im Inhalt.
  useEffect(() => {
    document.body.classList.add('overlay-window');
    return () => document.body.classList.remove('overlay-window');
  }, []);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const off = await listen<GuideState>(GUIDE_STATE_EVENT, (event) => {
        const state = event.payload;
        queue = queue.then(() => applyState(state));
      });

      if (cancelled) {
        off();
        return;
      }
      stop = off;

      // Erst horchen, dann melden. Andersherum kann die Antwort vor dem
      // Zuhoerer eintreffen, und das Overlay bliebe bis zum naechsten
      // Zonenwechsel leer.
      await emit(OVERLAY_READY_EVENT);
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  useEffect(() => {
    const toggle = listen('overlay-edit-toggle', () => {
      setEditMode((value) => !value);
    });

    // Groesse, Deckkraft und Verschiebung kommen aus den Einstellungen des
    // Hauptfensters. Der eigene Store haelt sie danach wie gewohnt.
    const settings = listen<OverlaySettings>(
      OVERLAY_SETTINGS_EVENT,
      (event) => {
        useSettingsStore.setState(event.payload);
      }
    );

    return () => {
      void toggle.then((off) => off());
      void settings.then((off) => off());
    };
  }, []);

  useEffect(() => {
    const element = document.getElementById(`edge-${currentEdge}`);
    if (element === null) return;

    setContentHeight(
      Math.ceil(element.getBoundingClientRect().height) +
        24 +
        OVERLAY_HEADER_HEIGHT
    );
  }, [currentEdge, route]);

  return (
    <InGameScreen editMode={editMode} onCloseEdit={() => setEditMode(false)} />
  );
}
