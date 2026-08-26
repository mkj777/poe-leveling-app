import { AppState, useAppStore } from '@/store/app.store';
import { Route, Routes } from 'react-router-dom';

import MainPage from './main.page';
import { publishOverlaySettings } from '@/services/overlay-settings';
import SettingsPage from './settings.page';
import appStates from '@/states/app.state';
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
    <Routes>
      <Route path='/' element={<MainPage />} />
      <Route path='/settings' element={<SettingsPage />} />
    </Routes>
  );
}
