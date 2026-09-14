import { AppScanningState, useAppStore } from '@/store/app.store';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

import { IState } from '@/hooks/useMachine';
import { OVERLAY_WINDOW_URL } from '@/utilities/constants';
import { invoke } from '@tauri-apps/api/core';

const OVERLAY_LABEL = 'overlay';

// getByLabel is asynchronous in Tauri 2; in v1 it was a direct access.
async function close(label: string) {
  const window = await WebviewWindow.getByLabel(label);
  await window?.close();
}

/**
 * The overlay is its own window. The main window stays untouched so that the
 * guide list and the settings remain reachable while the overlay runs.
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

        // Size and position are set by the overlay itself from the game
        // window, see usePoeWindow and ADR-0006.
        const overlay = new WebviewWindow(OVERLAY_LABEL, {
          url: OVERLAY_WINDOW_URL,
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

        // To the terminal instead of a console nobody sees from outside.
        // This is exactly where a missing webview permission went unnoticed.
        overlay.once('tauri://error', (event) => {
          void invoke('log_frontend', {
            level: 'overlay-window',
            message: String(event.payload)
          });
        });

        invoke('open_poe_window');
      },
      // Closing happens on entering `normal`, and every path from here leads
      // there. Two places were a leftover from the time with two windows
      // (ADR-0009): they raced each other, one won, the other found nothing
      // and reported "window not found".
      leave: () => {}
    }
  }
];

export default appStates;
