import { AppScanningState, AppState, useAppStore } from '@/store/app.store';
import {
  OVERLAY_ANCHOR,
  OVERLAY_BOTTOM_MARGIN,
  OVERLAY_MIN_HEIGHT
} from '@/utilities/constants';
import { isRegistered, register, unregister } from '@tauri-apps/api/globalShortcut';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import InGameScreen from '@/components/in-game-screen';
import LevellingGuideMain from '@/components/levelling-guide-main';
import MainScreen from '@/components/main-screen';
import Navbar from '@/components/navbar';
import { Switch } from 'ktools-r';
import { advanceEdge } from '@/utilities/route-progress';
import { appWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/api/dialog';
import { useInterval } from '@/hooks/useInterval';
import { usePoeWindow } from '@/hooks/usePoeWindow';
import { useRouteStore } from '@/store/route.store';
import { useSettingsStore } from '@/store/settings.store';

const OVERLAY_HOTKEYS = [
  'CmdOrCtrl+Shift+Alt+F12',
  'CmdOrCtrl+Shift+Alt+ArrowRight',
  'CmdOrCtrl+Shift+Alt+ArrowLeft',
  'CmdOrCtrl+Shift+Alt+O'
];

export default function MainPage() {
  const [areaName, setAreaName] = useState<string>();
  const [contentHeight, setContentHeight] = useState(OVERLAY_MIN_HEIGHT);
  const [editMode, setEditMode] = useState(false);

  const route = useRouteStore((state) => state.route);
  const currentEdge = useRouteStore((state) => state.currentEdge);

  const { setAppState, appScanningState } = useAppStore((state) => state);
  const appState = useAppStore((state) => state.appState);

  const clientTxtPath = useSettingsStore((state) => state.clientTxtPath);
  const setClientTxtPath = useSettingsStore((state) => state.setClientTxtPath);
  const setOverlayOffset = useSettingsStore((state) => state.setOverlayOffset);

  const { bounds } = usePoeWindow(appState === AppState.IN_GAME, contentHeight);

  //#region Client.txt
  useEffect(() => {
    if (clientTxtPath !== '') return;

    void invoke<string | null>('detect_client_txt')
      .then((detected) => {
        if (detected !== null) setClientTxtPath(detected);
      })
      // Scheitert die Erkennung, bleibt die manuelle Auswahl. Kein Grund,
      // eine unbehandelte Rejection zu werfen.
      .catch(() => undefined);
  }, [clientTxtPath, setClientTxtPath]);

  useInterval(async () => {
    if (appScanningState === AppScanningState.NOT_SCANNING) return;

    try {
      const response = await invoke<string>('get_area_name', {
        fileLocation: clientTxtPath
      });
      setAreaName(response);
    } catch {
      setAreaName('');
    }
  }, 1000);

  useEffect(() => {
    if (route === null || areaName === undefined || areaName === '') return;

    const store = useRouteStore.getState();
    const next = advanceEdge(route.edges, store.currentEdge, areaName);
    if (next !== store.currentEdge) store.setCurrentEdge(next);
  }, [areaName, route]);
  //#endregion

  //#region Shortcuts
  useEffect(() => {
    void registerShortcuts();

    return () => {
      for (const hotkey of OVERLAY_HOTKEYS) void unregister(hotkey);
    };
  }, []);

  const registerShortcuts = async () => {
    // Der Zustand wird bewusst ueber getState gelesen. Die Handler werden
    // einmal registriert und wuerden sonst auf einem eingefrorenen Wert
    // arbeiten.
    if (!(await isRegistered('CmdOrCtrl+Shift+Alt+F12'))) {
      await register('CmdOrCtrl+Shift+Alt+F12', () => {
        setAppState(AppState.NORMAL);
      });
    }

    if (!(await isRegistered('CmdOrCtrl+Shift+Alt+ArrowRight'))) {
      await register('CmdOrCtrl+Shift+Alt+ArrowRight', () => {
        const store = useRouteStore.getState();
        if (store.route === null) return;
        store.setCurrentEdge(
          Math.min(store.currentEdge + 1, store.route.edges.length - 1)
        );
      });
    }

    if (!(await isRegistered('CmdOrCtrl+Shift+Alt+ArrowLeft'))) {
      await register('CmdOrCtrl+Shift+Alt+ArrowLeft', () => {
        const store = useRouteStore.getState();
        store.setCurrentEdge(Math.max(store.currentEdge - 1, 0));
      });
    }

    if (!(await isRegistered('CmdOrCtrl+Shift+Alt+O'))) {
      await register('CmdOrCtrl+Shift+Alt+O', () => {
        setEditMode((value) => !value);
      });
    }
  };
  //#endregion

  useEffect(() => {
    void listen('showWindow', () => {
      setAppState(AppState.NORMAL);
    });
  }, []);

  //#region Overlay-Geometrie
  useEffect(() => {
    const element = document.getElementById(`edge-${currentEdge}`);
    if (element === null) return;

    if (appState === AppState.IN_GAME) {
      setContentHeight(Math.ceil(element.getBoundingClientRect().height) + 24);
    } else {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [appState, currentEdge, route]);

  useEffect(() => {
    void appWindow.setIgnoreCursorEvents(
      appState === AppState.IN_GAME && !editMode
    );
  }, [appState, editMode]);

  useEffect(() => {
    if (!editMode) return;

    // Beim Ziehen die neue Lage als Bruchteil des Spiel-Rects zuruecklegen,
    // nicht als Pixel. Sonst stimmt sie nach Aufloesungswechsel nicht mehr.
    const unlisten = appWindow.onMoved(async ({ payload }) => {
      if (bounds === null || !bounds.found) return;

      const size = await appWindow.innerSize();
      const centerX = payload.x + size.width / 2;
      const bottomY = payload.y + size.height;

      setOverlayOffset({
        dx: (centerX - bounds.x) / bounds.w - OVERLAY_ANCHOR.x,
        dy:
          (bottomY - bounds.y) / bounds.h -
          (OVERLAY_ANCHOR.y - OVERLAY_BOTTOM_MARGIN)
      });
    });

    return () => {
      void unlisten.then((off) => off());
    };
  }, [editMode, bounds, setOverlayOffset]);
  //#endregion

  const handleSetClientTxt = async () => {
    const selection = await open({
      multiple: false,
      filters: [{ name: 'Text', extensions: ['txt'] }]
    });

    if (selection) setClientTxtPath(selection as string);
  };

  return (
    <Switch>
      <Switch.Case condition={clientTxtPath === ''}>
        <Navbar />

        <div className='flex h-full flex-grow flex-col items-center justify-center gap-8 p-2 text-center'>
          <h2 className='justify-self-stretch underline'>
            Client.txt nicht gefunden
          </h2>
          <h3>
            Starte Path of Exile, dann wird der Pfad automatisch erkannt.
          </h3>
          <div className='flex flex-col'>
            <em>Sonst liegt sie ueblicherweise unter</em>
            <em>
              C:/Program Files (x86)/Grinding Gear Games/Path of
              Exile/logs/Client.txt
            </em>
          </div>
          <Button onClick={handleSetClientTxt}>Pfad selbst waehlen</Button>
        </div>
      </Switch.Case>

      <Switch.Case condition={appState === AppState.IN_GAME}>
        <InGameScreen
          editMode={editMode}
          onCloseEdit={() => setEditMode(false)}
        />
      </Switch.Case>

      <Switch.Default>
        <Navbar />
        <main className='flex-grow overflow-y-auto p-2'>
          <Switch>
            <Switch.Case condition={route !== null}>
              <LevellingGuideMain route={route!} />
            </Switch.Case>
            <Switch.Default>
              <MainScreen />
            </Switch.Default>
          </Switch>
        </main>
      </Switch.Default>
    </Switch>
  );
}
