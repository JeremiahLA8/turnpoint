import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom in this version ships a stub `localStorage` (a plain `{}`) instead of a
// real `Storage`. Replace it with a working in-memory Storage so tests can
// exercise auth's role-cache logic, which depends on getItem/setItem/removeItem
// /clear and a length-counted iteration.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null; }
  setItem(key: string, value: string): void { this.store.set(key, String(value)); }
  removeItem(key: string): void { this.store.delete(key); }
  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return index >= 0 && index < keys.length ? keys[index] : null;
  }
  [name: string]: any;
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  Object.defineProperty(window, name, {
    configurable: true,
    writable: true,
    value: new MemoryStorage(),
  });
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: (window as any)[name],
  });
}
