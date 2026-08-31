/**
 * Beendet das Overlay. Registriert wird es in `main.page.tsx`, genannt in den
 * Einstellungen und im letzten Schritt des Guides.
 *
 * Eine Konstante, damit die drei nicht auseinanderlaufen: ein Kürzel, das in
 * der App anders heisst als es wirkt, ist schlimmer als keins.
 */
export const SHORTCUT_CLOSE_OVERLAY = 'CmdOrCtrl+Alt+0';

/**
 * Wie ein Kürzel dem Nutzer gezeigt wird. Tauri schreibt `CmdOrCtrl`, auf der
 * Tastatur steht Ctrl.
 */
export function shortcutLabel(accelerator: string): string {
  return accelerator.replace('CmdOrCtrl', 'Ctrl');
}
