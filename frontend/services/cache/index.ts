import { idbClearPrefix, idbDel, idbGetMany, idbSet } from "../idb";

/**
 * Cache in front of Firestore reads and AI responses, kept on this device in
 * IndexedDB (see services/idb.ts). A cache failure is never an error: it reads
 * as a miss and the caller asks Firestore.
 */
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  /** One lookup for many keys; the result lines up with `keys`, null for a miss. */
  getMany<T>(keys: string[]): Promise<(T | null)[]>;
  /** `ttlSeconds` omitted means no expiry (cleared on sign-out). */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
}

const NS = "pb:";

/** `pb:<uid>:<kind>:<id>`. Keyed by user so accounts on one device never see each other's data. */
export const cacheKey = (uid: string, kind: string, id = "") => `${NS}${uid}:${kind}:${id}`;

export const cache: Cache = {
  async get<T>(key: string) {
    return (await idbGetMany<T>([key]))[0] ?? null;
  },
  getMany: <T>(keys: string[]) => idbGetMany<T>(keys),
  set: (key, value, ttl) => idbSet(key, value, ttl),
  del: (...keys) => idbDel(keys),
};

/** Removes everything cached for one user (on sign-out). */
export async function clearUserCache(uid: string) {
  await Promise.all([idbClearPrefix(`${NS}${uid}:`), idbClearPrefix(`ai:${uid}:`)]);
}
