import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/**
 * Autoupdate runs entirely in the Rust backend, see `src-tauri/src/updater.rs`.
 * Checked and downloaded at startup, applied on exit. The frontend plays no
 * part in it, it only learns that it happened.
 */
export const UPDATE_READY_EVENT = 'update-ready';

/**
 * Reports the version that becomes active on the next start. Comes exactly
 * once per session and only if something was really downloaded.
 */
export function onUpdateReady(
  handler: (version: string) => void
): Promise<() => void> {
  return listen<string>(UPDATE_READY_EVENT, (event) => handler(event.payload));
}

export async function currentVersion(): Promise<string> {
  return invoke<string>('update_current_version');
}

/**
 * Applies a waiting update right away and restarts the app.
 *
 * Does not fulfil the promise so much as speed it up: it would be applied
 * anyway, on the next start. On success the promise never resolves, because
 * the process ends first. Only a failure reports back.
 */
export async function applyUpdateNow(): Promise<string> {
  return invoke<string>('update_apply_now');
}
