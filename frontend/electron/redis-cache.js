const Redis = require("ioredis");

/**
 * Redis lookups for the renderer, reached over IPC (a browser page can't speak
 * the Redis protocol). Everything here is best-effort: if Redis isn't running or
 * is slow, every call resolves to a miss / no-op and the app reads Firestore as
 * if there were no cache.
 */

const URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const KEY_PREFIX = "pb:"; // the renderer can only touch keys in this namespace
const MAX_KEYS = 100;
const MAX_KEY_LENGTH = 300;
const MAX_VALUE_BYTES = 256 * 1024;
const MAX_TTL_SECONDS = 7 * 24 * 3600;
const OP_TIMEOUT_MS = 1500;

let client = null;
let warned = false;

function getClient() {
  if (client) return client;
  client = new Redis(URL, {
    lazyConnect: true,
    // Fail fast instead of queueing commands while Redis is down.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 1500,
    retryStrategy: (attempt) => Math.min(attempt * 2000, 30_000),
  });
  client.on("error", (err) => {
    if (warned) return;
    warned = true;
    console.warn(`[cache] Redis unavailable, reading from Firestore instead: ${err.message}`);
  });
  client.on("ready", () => {
    warned = false;
  });
  client.connect().catch(() => {});
  return client;
}

const withTimeout = (p) =>
  Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), OP_TIMEOUT_MS))]);

const validKey = (k) => typeof k === "string" && k.startsWith(KEY_PREFIX) && k.length <= MAX_KEY_LENGTH;
const validKeys = (keys) =>
  Array.isArray(keys) && keys.length > 0 && keys.length <= MAX_KEYS && keys.every(validKey);

/** Resolves to one JSON string (or null for a miss) per key. */
async function getMany(keys) {
  if (!validKeys(keys)) return [];
  try {
    return await withTimeout(getClient().mget(keys));
  } catch {
    return keys.map(() => null);
  }
}

async function set(key, json, ttlSeconds) {
  if (!validKey(key) || typeof json !== "string" || Buffer.byteLength(json) > MAX_VALUE_BYTES) return;
  const ttl = Math.min(Math.max(Math.floor(Number(ttlSeconds) || 0), 0), MAX_TTL_SECONDS);
  try {
    await withTimeout(ttl > 0 ? getClient().set(key, json, "EX", ttl) : getClient().set(key, json));
  } catch {
    /* best-effort */
  }
}

async function del(keys) {
  if (!validKeys(keys)) return;
  try {
    await withTimeout(getClient().del(keys));
  } catch {
    /* best-effort */
  }
}

function register(ipcMain) {
  ipcMain.handle("cache:get-many", (_e, keys) => getMany(keys));
  ipcMain.handle("cache:set", (_e, key, json, ttl) => set(key, json, ttl));
  ipcMain.handle("cache:del", (_e, keys) => del(keys));
}

function close() {
  client?.disconnect();
}

module.exports = { register, close };
