import type { Classification, RawMail } from "./mail/types";

/**
 * A copy of the loaded inbox kept in this browser so it survives a refresh, even
 * when the Gmail / Outlook login can't be renewed silently. The user chooses how
 * long it lives (0 = never kept). It never leaves the device and is removed on
 * sign-out, disconnecting an account, or when it expires.
 */

const PREFIX = "priority:mail-cache:";
const key = (uid: string) => `${PREFIX}${uid}`;

export interface CachedMail {
  /** Epoch ms of the last successful fetch from the mailboxes. */
  fetchedAt: number;
  /** Fetched pages, oldest page first. */
  pages: RawMail[][];
  analysis: Record<string, Classification>;
}

function isCachedMail(v: unknown): v is CachedMail {
  const c = v as CachedMail;
  return (
    !!c &&
    typeof c.fetchedAt === "number" &&
    Array.isArray(c.pages) &&
    c.pages.every(
      (p) => Array.isArray(p) && p.every((m) => m && typeof m.id === "string"),
    ) &&
    !!c.analysis &&
    typeof c.analysis === "object"
  );
}

export function clearMailCache(uid?: string) {
  try {
    if (uid) {
      localStorage.removeItem(key(uid));
      return;
    }
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* storage unavailable */
  }
}

export function saveMailCache(uid: string, entry: CachedMail, hours: number) {
  if (hours <= 0) return clearMailCache(uid);
  try {
    localStorage.setItem(key(uid), JSON.stringify(entry));
  } catch {
    // Quota exceeded: keep at least the newest page rather than nothing.
    try {
      localStorage.setItem(
        key(uid),
        JSON.stringify({ ...entry, pages: entry.pages.slice(0, 1) }),
      );
    } catch {
      /* give up: the cache is best-effort */
    }
  }
}

/** The saved inbox, or null if there is none, it expired, or caching is off. */
export function loadMailCache(uid: string, hours: number): CachedMail | null {
  if (hours <= 0) {
    clearMailCache(uid);
    return null;
  }
  try {
    const raw = localStorage.getItem(key(uid));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isCachedMail(parsed) || Date.now() - parsed.fetchedAt > hours * 3_600_000) {
      localStorage.removeItem(key(uid));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** "5 minutes ago", "3 hours ago", "2 days ago". */
export function timeAgo(ms: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - ms) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
