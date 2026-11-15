/**
 * A small key-value store on top of IndexedDB, kept on this device only.
 *
 * Unlike localStorage it holds far more than ~5MB (whole email bodies fit), and
 * unlike sessionStorage it survives the app being closed. Every entry can
 * expire. Everything here is best-effort: if IndexedDB is unavailable (private
 * window, blocked storage, server render) reads are misses and writes are no-ops.
 */

const DB_NAME = "prioritybox";
const STORE = "kv";
const VERSION = 1;

interface Entry {
  value: unknown;
  /** Epoch ms when the entry expires, or null for no expiry. */
  expires: number | null;
}

let opening: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  opening ??= new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  }).then((db) => {
    if (!db) opening = null; // try again next time
    return db;
  });
  return opening;
}

/** Runs `fn` in one transaction and resolves when the transaction completes. */
async function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => T,
): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    try {
      const t = db.transaction(STORE, mode);
      const result = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(result);
      t.onerror = () => resolve(null);
      t.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

const live = (e: Entry | undefined): e is Entry =>
  !!e && (e.expires === null || e.expires > Date.now());

/** One value per key (null for a miss or an expired entry), in the order of `keys`. */
export async function idbGetMany<T>(keys: string[]): Promise<(T | null)[]> {
  if (!keys.length) return [];
  const requests: IDBRequest<Entry | undefined>[] = [];
  const done = await tx("readonly", (s) => {
    for (const k of keys) requests.push(s.get(k));
    return true;
  });
  if (!done) return keys.map(() => null);
  return requests.map((r) => (live(r.result) ? (r.result.value as T) : null));
}

export async function idbGet<T>(key: string): Promise<T | null> {
  return (await idbGetMany<T>([key]))[0] ?? null;
}

/** Writes several entries in one transaction. `ttlSeconds` omitted or 0 means no expiry. */
export async function idbSetMany(entries: { key: string; value: unknown }[], ttlSeconds?: number) {
  if (!entries.length) return;
  const expires = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
  await tx("readwrite", (s) => {
    for (const { key, value } of entries) s.put({ value, expires } satisfies Entry, key);
  });
}

export async function idbSet(key: string, value: unknown, ttlSeconds?: number) {
  await idbSetMany([{ key, value }], ttlSeconds);
}

export async function idbDel(keys: string[]) {
  if (!keys.length) return;
  await tx("readwrite", (s) => {
    for (const k of keys) s.delete(k);
  });
}

/** Removes every key that starts with `prefix`. */
export async function idbClearPrefix(prefix: string) {
  await tx("readwrite", (s) => {
    s.delete(IDBKeyRange.bound(prefix, prefix + "￿"));
  });
}

/** Deletes expired entries. Cheap enough to run once per launch. */
export async function idbSweep() {
  await tx("readwrite", (s) => {
    const req = s.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      if (!live(cursor.value as Entry)) cursor.delete();
      cursor.continue();
    };
  });
}
