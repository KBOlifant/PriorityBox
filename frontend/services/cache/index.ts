/**
 * Placeholder cache backed by sessionStorage.
 *
 * The interface is deliberately Redis-shaped (async get/set with a TTL, del)
 * so a real Redis client can replace `sessionCache` later without touching
 * callers. Entries last for the browser tab's session.
 */
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  /** `ttlSeconds` omitted means "until the session ends". */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

const PREFIX = "priority:cache:";

interface Entry<T> {
  value: T;
  /** Epoch ms when the entry expires, or null for no expiry. */
  expires: number | null;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null; // storage blocked
  }
}

export const sessionCache: Cache = {
  async get<T>(key: string) {
    const s = storage();
    if (!s) return null;
    try {
      const raw = s.getItem(PREFIX + key);
      if (!raw) return null;
      const entry = JSON.parse(raw) as Entry<T>;
      if (entry.expires !== null && entry.expires < Date.now()) {
        s.removeItem(PREFIX + key);
        return null;
      }
      return entry.value;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, value: T, ttlSeconds?: number) {
    const entry: Entry<T> = {
      value,
      expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    };
    try {
      storage()?.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {
      /* quota exceeded or blocked: the cache is best-effort */
    }
  },

  async del(key: string) {
    try {
      storage()?.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
};

/** The cache the app uses. Swap this export to move to Redis. */
export const cache: Cache = sessionCache;
