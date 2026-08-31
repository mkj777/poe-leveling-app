import { AppState, useAppStore } from '@/store/app.store';
import { Route, Routes } from 'react-router-dom';

import type { OverlayPlacement, OverlayView } from '@/utilities/overlay-view';
import {
  EMPTY_OVERLAY_VIEW,
  OVERLAY_PLACEMENT_EVENT,
  OVERLAY_READY_EVENT,
  OVERLAY_VIEW_EVENT,
  buildOverlayView
} from '@/utilities/overlay-view';
import MainPage from './main.page';
import NewRunDialog from '@/components/new-run-dialog';
import { publishOverlaySettings } from '@/services/overlay-settings';
import SettingsPage from './settings.page';
import appStates from '@/states/app.state';
import { listen } from '@tauri-apps/api/event';
import { emit } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import useMachine from '@/hooks/useMachine';
import { useRouteStore } from '@/store/route.store';
import { useRouteSync } from '@/hooks/useRouteSync';
import { useSettingsStore } from '@/store/settings.store';

function overlayView(): OverlayView {
  const { route, currentEdge } = useRouteStore.getState();
  return route === null
    ? EMPTY_OVERLAY_VIEW
    : buildOverlayView(route, currentEdge);
}

export default function MainRoutes() {
  const { transition } = useMachine(appStates, 'normal');
  const appState = useAppStore((state) => state.appState);

  // Beides gehoert ausdruecklich hierher und nicht in App: App rendert in
  // jedem Fenster, auch im Overlay und im Layout-Fenster. Der Abgleich liefe
  // dort dreimal, und der Rundfunk wuerde sich selbst zuhoeren.
  useRouteSync();

  // Das Overlay zeigt nur an. Was es zeigt, rechnet dieses Fenster aus, denn
  // hier liegen Route und Spieldaten (ADR-0012).
  //
  // Hier und nicht in MainPage: von der Einstellungsseite aus wechselt man den
  // Modus, und dort ist MainPage nicht montiert.
  const route = useRouteStore((state) => state.route);
  const currentEdge = useRouteStore((state) => state.currentEdge);

  useEffect(() => {
    void emit(OVERLAY_VIEW_EVENT, overlayView());
  }, [route, currentEdge]);

  useEffect(() => {
    // Das Overlay startet spaeter als dieses Fenster und hat die bisherigen
    // Meldungen nie gehoert. Es meldet sich, sobald es horcht, und bekommt
    // Inhalt und Einstellungen als Antwort. Beides haelt es nur im Speicher.
    const ready = listen(OVERLAY_READY_EVENT, () => {
      void emit(OVERLAY_VIEW_EVENT, overlayView());
      publishOverlaySettings(useSettingsStore.getState());
    });

    // Die Gegenrichtung: gezogen und skaliert wird im Overlay, gespeichert
    // hier. Zwei Schreiber auf einem Eintrag haben sich schon einmal
    // gegenseitig ueberschrieben (ADR-0011, zweiter Nachtrag).
    const placement = listen<OverlayPlacement>(
      OVERLAY_PLACEMENT_EVENT,
      (event) => {
        const settings = useSettingsStore.getState();
        settings.setOverlayScale(event.payload.overlayScale);
        settings.setOverlayOffset(event.payload.overlayOffset);
      }
    );

    return () => {
      void ready.then((off) => off());
      void placement.then((off) => off());
    };
  }, []);

  useEffect(() => {
    publishOverlaySettings(useSettingsStore.getState());
    return useSettingsStore.subscribe(publishOverlaySettings);
  }, []);

  // Fernsteuerung aus dev_control.rs, damit sich das Overlay ohne Klick im
  // Fenster schalten laesst. Im Release gibt es den Server nicht.
  useEffect(() => {
    const unlisten = listen<string>('dev-control', (event) => {
      const running = useAppStore.getState().appState === AppState.IN_GAME;

      switch (event.payload) {
        case 'start':
          useAppStore.getState().setAppState(AppState.IN_GAME);
          break;
        case 'stop':
          useAppStore.getState().setAppState(AppState.NORMAL);
          break;
        case 'toggle':
          useAppStore
            .getState()
            .setAppState(running ? AppState.NORMAL : AppState.IN_GAME);
          break;
        case 'edit':
          void emit('overlay-edit-toggle');
          break;
      }
    });

    return () => {
      void unlisten.then((off) => off());
    };
  }, []);

  useEffect(() => {
    switch (appState) {
      case AppState.NORMAL:
        transition('normal');
        break;
      case AppState.IN_GAME:
        transition('in-game');
        break;
    }
  }, [appState]);

  return (
    <>
      {/* Ausserhalb der Routen: die Frage nach einem neuen Durchgang gilt dem
          Start der App, nicht einer Seite. */}
      <NewRunDialog />

      <Routes>
        <Route path='/' element={<MainPage />} />
        <Route path='/settings' element={<SettingsPage />} />
      </Routes>
    </>
  );
}
