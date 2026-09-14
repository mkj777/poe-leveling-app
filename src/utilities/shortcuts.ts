/**
 * Closes the overlay. Registered in `main.page.tsx`, named in the settings
 * and in the last step of the guide.
 *
 * One constant so the three do not drift apart: a shortcut the app names
 * differently from how it works is worse than none.
 */
export const SHORTCUT_CLOSE_OVERLAY = 'CmdOrCtrl+Alt+0';

/**
 * How a shortcut is shown to the user. Tauri writes `CmdOrCtrl`, the keyboard
 * says Ctrl.
 */
export function shortcutLabel(accelerator: string): string {
  return accelerator.replace('CmdOrCtrl', 'Ctrl');
}
