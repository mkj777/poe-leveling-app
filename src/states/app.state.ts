import { AppScanningState, useAppStore } from '@/store/app.store';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

import { IState } from '@/hooks/useMachine';
import { invoke } from '@tauri-apps/api/core';

const OVERLAY_LABEL = 'overlay';

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
      },
      leave: async () => {
        await close(OVERLAY_LABEL);
      }
    }
  }
];

export default appStates;
