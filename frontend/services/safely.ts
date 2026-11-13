/**
 * Firestore retries forever when it can't reach the database, so storage calls
 * that are optional get a deadline and resolve to null on failure.
 */
const STORAGE_TIMEOUT_MS = 5000;

export function withTimeout<T>(promise: Promise<T>, ms = STORAGE_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export async function safely<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await withTimeout(fn());
  } catch (err) {
    console.warn(`[storage] ${label} failed`, err);
    return null;
  }
}
