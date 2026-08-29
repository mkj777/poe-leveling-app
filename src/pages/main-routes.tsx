import { AppState, useAppStore } from '@/store/app.store';
import { Route, Routes } from 'react-router-dom';

import MainPage from './main.page';
import NewRunDialog from '@/components/new-run-dialog';
import { publishOverlaySettings } from '@/services/overlay-settings';
import SettingsPage from './settings.page';
import appStates from '@/states/app.state';
import { listen } from '@tauri-apps/api/event';
import { emit } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import useMachine from '@/hooks/useMachine';
import { useRouteSync } from '@/hooks/useRouteSync';
import { useSettingsStore } from '@/store/settings.store';

export default function MainRoutes() {
  const { transition } = useMachine(appStates, 'normal');
  const appState = useAppStore((state) => state.appState);

  // Beides gehoert ausdruecklich hierher und nicht in App: App rendert in
  // jedem Fenster, auch im Overlay und im Layout-Fenster. Der Abgleich liefe
  // dort dreimal, und der Rundfunk wuerde sich selbst zuhoeren.
  useRouteSync();

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
