import { useSyncExternalStore } from "react";

const KEY = "priority-read";
const listeners = new Set<() => void>();
let cache: Set<string> | null = null;

function load(): Set<string> {
  if (!cache) {
    try {
      cache = new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
    } catch {
      cache = new Set();
    }
  }
  return cache;
}

/** Remembers, on this device, that an email has been opened at least once. */
export function markRead(id: string) {
  const set = load();
  if (set.has(id)) return;
  cache = new Set(set).add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...cache]));
  } catch {
    /* private mode: it just won't persist */
  }
  listeners.forEach((l) => l());
}

export function useIsRead(id: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => load().has(id),
    () => false,
  );
}
