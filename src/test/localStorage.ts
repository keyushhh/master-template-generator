/** A localStorage that lives in a Map, for tests that run without a browser. */
export function installMemoryStorage(): Storage {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  return storage;
}

/** Makes every write throw, the way a browser at its storage ceiling does. */
export function fillStorage(): void {
  const full = {
    ...localStorage,
    setItem: () => {
      throw new DOMException('QuotaExceededError');
    },
  } as unknown as Storage;
  Object.defineProperty(globalThis, 'localStorage', { value: full, configurable: true, writable: true });
}
