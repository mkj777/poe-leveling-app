import { AppScanningState, useAppStore } from '@/store/app.store';
import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { availableMonitors } from '@tauri-apps/api/window';

import { IState } from '@/hooks/useMachine';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '@/store/settings.store';

const OVERLAY_LABEL = 'overlay';
const LAYOUTMAP_LABEL = 'layoutmap';

// getByLabel ist in Tauri 2 asynchron, in v1 war es ein direkter Zugriff.
async function close(label: string) {
  const window = await WebviewWindow.getByLabel(label);
  await window?.close();
}

/**
 * Das Overlay ist ein eigenes Fenster. Das Hauptfenster bleibt dabei
 * unangetastet, damit Guide-Liste und Einstellungen erreichbar bleiben,
 * waehrend das Overlay laeuft.
 */
const appStates: IState[] = [
  {
    name: 'normal',
    on: {
      enter: async () => {
        await close(OVERLAY_LABEL);
        await close(LAYOUTMAP_LABEL);

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
        useAppStore.setState({
          appScanningState: AppScanningState.SCANNING
        });

        // Groesse und Position setzt das Overlay selbst anhand des
        // Spielfensters, siehe usePoeWindow und ADR-0006.
        const overlay = new WebviewWindow(OVERLAY_LABEL, {
          url: 'index.html/#/overlay',
          title: 'PoE Leveling Guide Overlay',
          alwaysOnTop: true,
          decorations: false,
          transparent: true,
          resizable: false,
          skipTaskbar: true,
          focus: false,
          width: 480,
          height: 120
        });

        // Ins Terminal statt in eine Konsole, die von aussen niemand sieht.
        // Genau hier blieb der fehlende Webview-Berechtigung unbemerkt.
        overlay.once('tauri://error', (event) => {
          void invoke('log_frontend', {
            level: 'overlay-window',
            message: String(event.payload)
          });
        });

        invoke('open_poe_window');

        if (useSettingsStore.getState().showLayout) {
          const monitors = await availableMonitors();
          const monitorSize = monitors[0].size;

          const layoutmapWindow = new WebviewWindow(LAYOUTMAP_LABEL, {
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

          layoutmapWindow.once('tauri://error', (event) => {
            void invoke('log_frontend', {
              level: 'layoutmap-window',
              message: String(event.payload)
            });
          });
        }
      },
      leave: async () => {
        await close(OVERLAY_LABEL);
        await close(LAYOUTMAP_LABEL);
      }
    }
  }
];

export default appStates;
