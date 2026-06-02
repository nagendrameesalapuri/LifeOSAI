// Module-level session cache — persists across React component mount/unmount within the same browser tab.
// Unlike useState, this survives page navigation (switching /english → /kannada → back to /english).
// Unlike localStorage, this doesn't persist across browser restarts (intentional — lessons refresh daily).

interface Entry { data: any; expiresAt: number }

const store = new Map<string, Entry>();

function todayMidnight(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export const cache = {
  /** Store data. Default TTL = end of today (lessons are daily). Pass ttlMs to override. */
  set(key: string, data: any, ttlMs?: number) {
    store.set(key, { data, expiresAt: ttlMs ? Date.now() + ttlMs : todayMidnight() });
  },

  /** Return cached data if still fresh, otherwise null. */
  get<T = any>(key: string): T | null {
    const entry = store.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      store.delete(key);
      return null;
    }
    return entry.data as T;
  },

  /** Remove an entry (e.g. after user logs new data and we want a fresh fetch). */
  delete(key: string) {
    store.delete(key);
  },

  /** Wipe everything — useful on sign-out. */
  clear() {
    store.clear();
  },
};
