/**
 * The stores persist via zustand/persist in localStorage. Node has none, so
 * the middleware warns on every write. An in-memory version not only removes
 * the noise, it lets the persistence path run in the tests in the first
 * place.
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
