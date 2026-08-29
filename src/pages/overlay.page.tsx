import { useEffect, useState } from 'react';

import InGameScreen from '@/components/in-game-screen';
import {
  OVERLAY_HEADER_HEIGHT,
  OVERLAY_MIN_HEIGHT
} from '@/utilities/constants';
import type { GuideMode, GuideModeMessage } from '@/utilities/guide-mode';
import type { OverlaySettings } from '@/services/overlay-settings';
import { GUIDE_MODE_EVENT } from '@/utilities/guide-mode';
import { OVERLAY_SETTINGS_EVENT } from '@/services/overlay-settings';
import { listen } from '@tauri-apps/api/event';
import { loadRouteFromCache } from '@/services/route-sync.tauri';
import { usePoeWindow } from '@/hooks/usePoeWindow';
import { useGuideStore } from '@/store/guide.store';
import { useRouteStore } from '@/store/route.store';
import { useSettingsStore } from '@/store/settings.store';

async function loadRoute(mode: GuideMode, edge?: number) {
  const loaded = await loadRouteFromCache(mode);
  if (loaded === null) return;

  const store = useRouteStore.getState();
  store.setRoute(loaded.route, loaded.sha);

  // Erst nach der Route: setCurrentEdge schlaegt die Zone darin nach.
  if (edge !== undefined) store.setCurrentEdge(edge);
}

/**
 * Eigenes Fenster, damit das Hauptfenster Hauptfenster bleiben kann. Es haengt
 * bewusst nicht am Hauptfenster: die Route parst es selbst aus dem lokalen
 * Cache, den Fortschritt bekommt es als Ereignis.
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

  // Der Modus kommt beim Aufbau aus dem eigenen Store, den zustand aus dem
  // gemeinsamen localStorage wiederherstellt. Ein Wechsel danach kommt als
  // Ereignis aus dem Hauptfenster.
  useEffect(() => {
    void loadRoute(useGuideStore.getState().mode);
  }, []);

  useEffect(() => {
    const edge = listen<number>('edge-changed', (event) => {
      useRouteStore.getState().setCurrentEdge(event.payload);
    });

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

    const guideMode = listen<GuideModeMessage>(GUIDE_MODE_EVENT, (event) => {
      useGuideStore.getState().setMode(event.payload.mode);
      void loadRoute(event.payload.mode, event.payload.currentEdge);
    });

    return () => {
      void edge.then((off) => off());
      void toggle.then((off) => off());
      void settings.then((off) => off());
      void guideMode.then((off) => off());
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
