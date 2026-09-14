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

  // Both belong explicitly here and not in App: App renders in every window,
  // including the overlay and the layout window. The sync would run three
  // times there, and the broadcast would listen to itself.
  useRouteSync();

  // The overlay is display only. What it shows is computed by this window,
  // because route and game data live here (ADR-0012).
  //
  // Here and not in MainPage: the mode is switched from the settings page,
  // and MainPage is not mounted there.
  const route = useRouteStore((state) => state.route);
  const currentEdge = useRouteStore((state) => state.currentEdge);

  useEffect(() => {
    void emit(OVERLAY_VIEW_EVENT, overlayView());
  }, [route, currentEdge]);

  useEffect(() => {
    // The overlay starts later than this window and never heard the earlier
    // messages. It reports in as soon as it listens and gets content and
    // settings as the answer. It holds both in memory only.
    const ready = listen(OVERLAY_READY_EVENT, () => {
      void emit(OVERLAY_VIEW_EVENT, overlayView());
      publishOverlaySettings(useSettingsStore.getState());
    });

    // The reverse direction: dragging and scaling happen in the overlay,
    // saving here. Two writers on one entry have already overwritten each
    // other once (ADR-0011, second addendum).
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

  // Remote control from dev_control.rs, so the overlay can be toggled without
  // a click in the window. The server does not exist in the release.
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
      {/* Outside the routes: the question about a new run concerns the start
          of the app, not a page. */}
      <NewRunDialog />

      <Routes>
        <Route path='/' element={<MainPage />} />
        <Route path='/settings' element={<SettingsPage />} />
      </Routes>
    </>
  );
}
