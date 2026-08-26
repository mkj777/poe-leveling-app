/**
 * Die Stores speichern ueber zustand/persist im localStorage. Node hat keinen,
 * also warnt die Middleware bei jedem Schreiben. Eine Fassung im Speicher
 * beseitigt nicht nur das Rauschen, sie laesst den Speicherpfad in den Tests
 * ueberhaupt erst laufen.
 */
class MemoryStorage implements Storage {
  private entries = new Map<string, string>();

  get length() {
    return this.entries.size;
  }

  clear() {
    this.entries.clear();
  }

  getItem(key: string) {
    return this.entries.get(key) ?? null;
  }

  key(index: number) {
    return [...this.entries.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.entries.delete(key);
  }

  setItem(key: string, value: string) {
    this.entries.set(key, value);
  }
}

globalThis.localStorage = new MemoryStorage();
