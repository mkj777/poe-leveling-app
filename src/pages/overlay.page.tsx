import { useEffect, useState } from 'react';

import InGameScreen from '@/components/in-game-screen';
import {
  OVERLAY_HEADER_HEIGHT,
  OVERLAY_MIN_HEIGHT
} from '@/utilities/constants';
import type { OverlaySettings } from '@/services/overlay-settings';
import { OVERLAY_SETTINGS_EVENT } from '@/services/overlay-settings';
import { listen } from '@tauri-apps/api/event';
import { loadRouteFromCache } from '@/services/route-sync.tauri';
import { usePoeWindow } from '@/hooks/usePoeWindow';
import { useRouteStore } from '@/store/route.store';
import { useSettingsStore } from '@/store/settings.store';

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

  useEffect(() => {
    void (async () => {
      const loaded = await loadRouteFromCache();
      if (loaded !== null) useRouteStore.getState().setRoute(loaded.route, loaded.sha);
    })();
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

    return () => {
      void edge.then((off) => off());
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
