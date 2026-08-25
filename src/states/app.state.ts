import { AppScanningState, useAppStore } from '@/store/app.store';
import {
  LogicalPosition,
  LogicalSize,
  WebviewWindow,
  appWindow,
  availableMonitors
} from '@tauri-apps/api/window';

import { IState } from '@/hooks/useMachine';
import { invoke } from '@tauri-apps/api/tauri';
import { useSettingsStore } from '@/store/settings.store';

const appStates: IState[] = [
  {
    name: 'normal',
    on: {
      enter: async () => {
        appWindow.setSize(new LogicalSize(800, 600));

        appWindow.setAlwaysOnTop(false);
        appWindow.setIgnoreCursorEvents(false);
        document.documentElement.style.fontSize = '';

        useAppStore.setState({
          appScanningState: AppScanningState.NOT_SCANNING
        });
      },
      leave: () => {}
    }
  },
  {
    name: 'in-game',
    on: {
      enter: async () => {
        // Position und Groesse setzt usePoeWindow anhand des Spielfensters
        // (ADR-0005, ADR-0006). Hier bleibt nur, was den Fenstercharakter
        // ausmacht.
        await appWindow.setAlwaysOnTop(true);
        await appWindow.setIgnoreCursorEvents(true);
        await appWindow.setSkipTaskbar(true);
        document.body.classList.add('bg-background/70');

        useAppStore.setState({
          appScanningState: AppScanningState.SCANNING
        });

        invoke('open_poe_window');

        if (useSettingsStore.getState().showLayout) {
          const monitors = await availableMonitors();
          const monitorSize = monitors[0].size;

          const layoutmapWindow = new WebviewWindow('layoutmap', {
            url: 'index.html/#/layoutmap',
            alwaysOnTop: true,
            resizable: false,
            transparent: true,
            decorations: false
          });

          layoutmapWindow.once('tauri://created', () => {
            layoutmapWindow.setSize(new LogicalSize(424 / 3, 230 / 3));
            layoutmapWindow.setPosition(
              new LogicalPosition(
                0,
                monitorSize.height / 2 - monitorSize.height / 5
              )
            );
          });

          layoutmapWindow.once('tauri://error', function (e) {
            console.log('error creating layoutmap window', e);
          });
        }
      },
      leave: async () => {
        document.body.classList.remove('bg-background/70');
        await appWindow.setSkipTaskbar(false);

        const layoutmapWindow = WebviewWindow.getByLabel('layoutmap');

        if (layoutmapWindow) {
          layoutmapWindow.close();
        }

        const monitors = await availableMonitors();
        const monitorSize = monitors[0].size;

        appWindow.setPosition(
          new LogicalPosition(
            monitorSize.width / 2 - 400,
            monitorSize.height / 2 - 300
          )
        );

        await appWindow.setFocus();
      }
    }
  }
];

export default appStates;
