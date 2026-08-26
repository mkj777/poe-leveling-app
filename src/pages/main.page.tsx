import { AppScanningState, AppState, useAppStore } from '@/store/app.store';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import LevellingGuideMain from '@/components/levelling-guide-main';
import MainScreen from '@/components/main-screen';
import Navbar from '@/components/navbar';
import { Switch } from 'ktools-r';
import { advanceEdge } from '@/utilities/route-progress';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { useInterval } from '@/hooks/useInterval';
import { useRouteStore } from '@/store/route.store';
import { useSettingsStore } from '@/store/settings.store';

// Modulweit, nicht pro Komponente. Globale Hotkeys gehoeren dem Prozess, nicht
// einem Mount: unter StrictMode laeuft der Effekt doppelt und lief sich mit
// seinem eigenen Cleanup ins "hotkey already registered". Schlimmer noch, das
// Cleanup meldete sie beim Wechsel in die Einstellungen ab und sie blieben tot.
let shortcutsBound = false;

export default function MainPage() {
  const [areaName, setAreaName] = useState<string>();

  const route = useRouteStore((state) => state.route);
  const currentEdge = useRouteStore((state) => state.currentEdge);

  const { setAppState, appScanningState } = useAppStore((state) => state);

  const clientTxtPath = useSettingsStore((state) => state.clientTxtPath);
  const setClientTxtPath = useSettingsStore((state) => state.setClientTxtPath);

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
    if (shortcutsBound) return;
    shortcutsBound = true;

    void (async () => {
      // Erst alles abraeumen, was ein vorheriger Lauf oder ein Hot-Reload
      // stehen gelassen hat, dann der Reihe nach neu binden.
      await unregisterAll();

      // Der Zustand wird bewusst ueber getState gelesen. Die Handler werden
      // einmal registriert und arbeiteten sonst auf einem eingefrorenen Wert.
      await register('CmdOrCtrl+Shift+Alt+F12', () => {
        setAppState(AppState.NORMAL);
      });

      await register('CmdOrCtrl+Shift+Alt+ArrowRight', () => {
        const store = useRouteStore.getState();
        if (store.route === null) return;
        store.setCurrentEdge(
          Math.min(store.currentEdge + 1, store.route.edges.length - 1)
        );
      });

      await register('CmdOrCtrl+Shift+Alt+ArrowLeft', () => {
        const store = useRouteStore.getState();
        store.setCurrentEdge(Math.max(store.currentEdge - 1, 0));
      });

      await register('CmdOrCtrl+Shift+Alt+O', () => {
        void emit('overlay-edit-toggle');
      });
    })();
  }, []);
  //#endregion

  useEffect(() => {
    void listen('showWindow', () => {
      setAppState(AppState.NORMAL);
    });
  }, []);

  // Das Overlay ist ein eigenes Fenster und haelt seinen eigenen Zustand.
  // Der Fortschritt kommt von hier, weil hier Client.txt gelesen wird.
  useEffect(() => {
    void emit('edge-changed', currentEdge);
  }, [currentEdge]);

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
            Client.txt not found
          </h2>
          <h3>
            Start Path of Exile and the path is picked up on its own.
          </h3>
          <div className='flex flex-col'>
            <em>Otherwise it usually sits at</em>
            <em>
              C:/Program Files (x86)/Grinding Gear Games/Path of
              Exile/logs/Client.txt
            </em>
          </div>
          <Button onClick={handleSetClientTxt}>Choose it yourself</Button>
        </div>
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
