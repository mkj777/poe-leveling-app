import { AppState, useAppStore } from '@/store/app.store';
import { Route, Routes } from 'react-router-dom';

import type { GuideState } from '@/utilities/guide-mode';
import { GUIDE_STATE_EVENT, OVERLAY_READY_EVENT } from '@/utilities/guide-mode';
import MainPage from './main.page';
import NewRunDialog from '@/components/new-run-dialog';
import { publishOverlaySettings } from '@/services/overlay-settings';
import SettingsPage from './settings.page';
import appStates from '@/states/app.state';
import { listen } from '@tauri-apps/api/event';
import { emit } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import useMachine from '@/hooks/useMachine';
import { useGuideStore } from '@/store/guide.store';
import { useRouteStore } from '@/store/route.store';
import { useRouteSync } from '@/hooks/useRouteSync';
import { useSettingsStore } from '@/store/settings.store';

function guideState(): GuideState {
  return {
    mode: useGuideStore.getState().mode,
    currentEdge: useRouteStore.getState().currentEdge
  };
}

export default function MainRoutes() {
  const { transition } = useMachine(appStates, 'normal');
  const appState = useAppStore((state) => state.appState);

  // Beides gehoert ausdruecklich hierher und nicht in App: App rendert in
  // jedem Fenster, auch im Overlay und im Layout-Fenster. Der Abgleich liefe
  // dort dreimal, und der Rundfunk wuerde sich selbst zuhoeren.
  useRouteSync();

  // Das Overlay parst seine Route selbst und braucht dafuer die Lesart. Es
  // bekommt sie zu jeder Kante mitgeschickt, nicht nur beim Wechsel: eine
  // blosse Zahl trifft in der kuerzeren Speedleveling-Liste eine andere Zone
  // als in der laengeren des Ligastarts (ADR-0011).
  //
  // Hier und nicht in MainPage: von der Einstellungsseite aus wechselt man den
  // Modus, und dort war MainPage nicht mehr montiert.
  const mode = useGuideStore((state) => state.mode);
  const currentEdge = useRouteStore((state) => state.currentEdge);

  useEffect(() => {
    void emit(GUIDE_STATE_EVENT, { mode, currentEdge } satisfies GuideState);
  }, [mode, currentEdge]);

  // Das Overlay startet spaeter als dieses Fenster und hat die bisherigen
  // Meldungen nie gehoert. Es meldet sich, sobald es horcht, und bekommt den
  // Stand als Antwort.
  useEffect(() => {
    const ready = listen(OVERLAY_READY_EVENT, () => {
      void emit(GUIDE_STATE_EVENT, guideState());
    });

    return () => {
      void ready.then((off) => off());
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
