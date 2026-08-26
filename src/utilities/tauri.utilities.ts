import { join, resourceDir } from '@tauri-apps/api/path';

import { convertFileSrc } from '@tauri-apps/api/core';
import { readDir } from '@tauri-apps/plugin-fs';

/**
 * Die Zonenbilder heissen `<areaId> <nummer>.png`. In Tauri 2 liefert readDir
 * nur noch Namen und keine vollen Pfade mehr, der Pfad wird also selbst
 * zusammengesetzt.
 */
export async function getImagesWithPattern(pattern: string): Promise<string[]> {
  const directory = await join(await resourceDir(), 'resources', 'zones');
  const entries = await readDir(directory);

  const matching = entries.filter(
    (entry) => entry.isFile && entry.name.split(' ')[0] === pattern
  );

  return Promise.all(
    matching.map(async (entry) =>
      convertFileSrc(await join(directory, entry.name))
    )
  );
}
