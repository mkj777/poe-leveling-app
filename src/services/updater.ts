import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/**
 * Autoupdate laeuft vollstaendig im Rust-Backend, siehe `src-tauri/src/updater.rs`.
 * Geprueft und geladen wird beim Start, eingespielt beim Beenden. Das Frontend
 * hat daran keinen Anteil, es erfaehrt nur, dass es passiert ist.
 */
export const UPDATE_READY_EVENT = 'update-ready';

/**
 * Meldet die Version, die beim naechsten Start aktiv wird. Kommt genau einmal
 * je Sitzung und nur, wenn wirklich etwas geladen wurde.
 */
export function onUpdateReady(
  handler: (version: string) => void
): Promise<() => void> {
  return listen<string>(UPDATE_READY_EVENT, (event) => handler(event.payload));
}

export async function currentVersion(): Promise<string> {
  return invoke<string>('update_current_version');
}
