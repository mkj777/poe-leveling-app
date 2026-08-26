import { type Update, check } from '@tauri-apps/plugin-updater';

import { relaunch } from '@tauri-apps/plugin-process';

/**
 * In Tauri 2 liefert check() das Update-Objekt selbst, und installiert wird
 * darauf. Das v1-Paar aus checkUpdate und installUpdate gibt es nicht mehr,
 * also muss der gefundene Stand zwischen Pruefung und Installation gehalten
 * werden.
 */
let pending: Update | null = null;

export async function checkForUpdate(): Promise<string | null> {
  pending = await check();
  return pending?.version ?? null;
}

export async function installPendingUpdate(): Promise<void> {
  if (pending === null) return;

  await pending.downloadAndInstall();
  await relaunch();
}
