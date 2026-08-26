import { invoke } from '@tauri-apps/api/core';

/**
 * Autoupdate laeuft ueber Velopack im Rust-Backend. Die Pruefung merkt den
 * gefundenen Stand dort vor, damit die Installation ihn nicht ein zweites Mal
 * aus dem Netz holt.
 */
export async function checkForUpdate(): Promise<string | null> {
  return invoke<string | null>('update_check');
}

/**
 * Kehrt im Erfolgsfall nicht zurueck: Velopack ersetzt den laufenden Prozess
 * durch die neue Version.
 */
export async function installPendingUpdate(): Promise<void> {
  await invoke('update_install');
}

export async function currentVersion(): Promise<string> {
  return invoke<string>('update_current_version');
}
