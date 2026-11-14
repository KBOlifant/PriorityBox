/**
 * Cache in front of Firestore reads.
 *
 * In the desktop app it is Redis, reached through Electron's main process
 * (a web page can't open a Redis connection). Anywhere else (`next dev` in a
 * browser) it falls back to sessionStorage with the same interface. A cache
 * failure is never an error: it reads as a miss and the caller asks Firestore.
 */
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  /** One lookup for many keys; the result lines up with `keys`, null for a miss. */
  getMany<T>(keys: string[]): Promise<(T | null)[]>;
  /** `ttlSeconds` omitted means "until the session ends" (or until Redis evicts it). */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
}

/** Every key starts with this; the main process rejects anything else. */
const NS = "pb:";

/** `pb:<uid>:<kind>:<id>`. Keyed by user so accounts sharing one Redis never see each other's data. */
export const cacheKey = (uid: string, kind: string, id = "") => `${NS}${uid}:${kind}:${id}`;

const parse = <T>(raw: string | null | undefined): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/* ---------- Redis, via Electron ---------- */

const redisCache: Cache = {
  async get<T>(key: string) {
    return (await this.getMany<T>([key]))[0] ?? null;
  },
  async getMany<T>(keys: string[]) {
    if (!keys.length) return [];
    try {
      const raw = await window.desktop!.cache.getMany(keys);
      return keys.map((_, i) => parse<T>(raw[i]));
    } catch {
      return keys.map(() => null);
    }
  },
  async set<T>(key: string, value: T, ttlSeconds?: number) {
    try {
      await window.desktop!.cache.set(key, JSON.stringify(value), ttlSeconds);
    } catch {
      /* best-effort */
    }
  },
  async del(...keys: string[]) {
    if (!keys.length) return;
    try {
      await window.desktop!.cache.del(keys);
    } catch {
      /* best-effort */
    }
  },
};

/* ---------- sessionStorage fallback ---------- */

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

  async getMany<T>(keys: string[]) {
    return Promise.all(keys.map((k) => this.get<T>(k)));
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

  async del(...keys: string[]) {
    try {
      for (const k of keys) storage()?.removeItem(PREFIX + k);
    } catch {
      /* ignore */
    }
  },
};

/** The cache the app uses: Redis in the desktop app, sessionStorage otherwise. */
export const cache: Cache = {
  get: (key) => impl().get(key),
  getMany: (keys) => impl().getMany(keys),
  set: (key, value, ttl) => impl().set(key, value, ttl),
  del: (...keys) => impl().del(...keys),
};

// Chosen per call: `window.desktop` doesn't exist while rendering on the server.
const impl = (): Cache =>
  typeof window !== "undefined" && window.desktop?.cache ? redisCache : sessionCache;
