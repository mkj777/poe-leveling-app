import { useEffect, useRef, useState } from 'react';

import InGameScreen from '@/components/in-game-screen';
import {
  OVERLAY_HEADER_HEIGHT,
  OVERLAY_MIN_HEIGHT
} from '@/utilities/constants';
import type { OverlaySettings } from '@/services/overlay-settings';
import type { OverlayView } from '@/utilities/overlay-view';
import {
  EMPTY_OVERLAY_VIEW,
  OVERLAY_READY_EVENT,
  OVERLAY_VIEW_EVENT
} from '@/utilities/overlay-view';
import { OVERLAY_SETTINGS_EVENT } from '@/services/overlay-settings';
import { emit, listen } from '@tauri-apps/api/event';
import { usePoeWindow } from '@/hooks/usePoeWindow';
import { useSettingsStore } from '@/store/settings.store';

/**
 * Eigenes Fenster, damit das Hauptfenster Hauptfenster bleiben kann.
 *
 * Es zeigt an und sonst nichts (ADR-0012): keine Route, keine Spieldaten, kein
 * Fortschritt, kein Speicher. Was zu sehen ist, sagt ihm das Hauptfenster,
 * fertig ausgerechnet. Was der Nutzer hier zieht, meldet es dorthin zurueck.
 */
export default function OverlayPage() {
  const [view, setView] = useState<OverlayView>(EMPTY_OVERLAY_VIEW);
  const [contentHeight, setContentHeight] = useState(OVERLAY_MIN_HEIGHT);
  const [editMode, setEditMode] = useState(false);

  const content = useRef<HTMLDivElement>(null);

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
      const off = await listen<OverlayView>(OVERLAY_VIEW_EVENT, (event) => {
        setView(event.payload);
      });

      if (cancelled) {
        off();
        return;
      }
      stop = off;

      // Erst horchen, dann melden. Andersherum kann die Antwort vor dem
      // Zuhoerer eintreffen, und das Overlay bliebe leer, bis sich der Stand
      // das naechste Mal von selbst aendert.
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

    // Groesse, Deckkraft und Verschiebung gehoeren dem Hauptfenster. Hier
    // liegen sie nur im Speicher, damit gezeichnet werden kann.
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
    if (content.current === null) return;

    setContentHeight(
      Math.ceil(content.current.getBoundingClientRect().height) +
        24 +
        OVERLAY_HEADER_HEIGHT
    );
  }, [view]);

  return (
    <InGameScreen
      view={view}
      contentRef={content}
      editMode={editMode}
      onCloseEdit={() => setEditMode(false)}
    />
  );
}
