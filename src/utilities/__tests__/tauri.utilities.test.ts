import { beforeEach, describe, expect, it, vi } from 'vitest';

const readDir = vi.fn();
const convertFileSrc = vi.fn((p: string) => `asset://${p}`);

vi.mock('@tauri-apps/plugin-fs', () => ({ readDir }));
vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc }));
vi.mock('@tauri-apps/api/path', () => ({
  resourceDir: async () => 'C:/app',
  join: async (...parts: string[]) => parts.join('/')
}));

const { getImagesWithPattern } = await import('../tauri.utilities');

const entry = (name: string, isFile = true) => ({
  name,
  isFile,
  isDirectory: !isFile,
  isSymlink: false
});

describe('getImagesWithPattern', () => {
  beforeEach(() => {
    readDir.mockReset();
    convertFileSrc.mockClear();
  });

  it('nimmt nur Bilder, deren Id vor dem Leerzeichen passt', async () => {
    readDir.mockResolvedValue([
      entry('1_1_2 1.png'),
      entry('1_1_2 2.png'),
      entry('1_1_20 1.png'),
      entry('1_1_3 1.png')
    ]);

    const result = await getImagesWithPattern('1_1_2');

    // 1_1_20 faengt zwar mit 1_1_2 an, ist aber eine andere Zone. Ein
    // Praefixvergleich statt des Vergleichs bis zum Leerzeichen waere hier
    // still falsch.
    expect(result).toEqual([
      'asset://C:/app/resources/zones/1_1_2 1.png',
      'asset://C:/app/resources/zones/1_1_2 2.png'
    ]);
  });

  it('laesst Verzeichnisse aus', async () => {
    readDir.mockResolvedValue([entry('1_1_2', false), entry('1_1_2 1.png')]);

    expect(await getImagesWithPattern('1_1_2')).toHaveLength(1);
  });

  it('liefert nichts, wenn zur Zone kein Bild existiert', async () => {
    readDir.mockResolvedValue([entry('1_1_3 1.png')]);

    expect(await getImagesWithPattern('9_9_9')).toEqual([]);
  });

  it('kommt mit einem leeren Verzeichnis zurecht', async () => {
    readDir.mockResolvedValue([]);

    expect(await getImagesWithPattern('1_1_2')).toEqual([]);
  });

  it('sucht im Ressourcenverzeichnis der Anwendung', async () => {
    readDir.mockResolvedValue([]);
    await getImagesWithPattern('1_1_2');

    expect(readDir).toHaveBeenCalledWith('C:/app/resources/zones');
  });
});
