/**
 * The text of each saved email, kept on this device only (never in Firestore),
 * so a saved email can still be read after its inbox is disconnected or while
 * offline. A copy is taken when the email is saved and is removed when the
 * email is removed from the saved list or the user signs out.
 */

const PREFIX = "priority:saved-bodies:";
const key = (uid: string) => `${PREFIX}${uid}`;
/** One long thread shouldn't use up the browser's storage. */
const MAX_BODY_CHARS = 20_000;

export interface SavedBody {
  body: string;
  /** When the email was received, as shown on cards ("Today", "Mar 4"). */
  day: string;
  time: string;
}

type Store = Record<string, SavedBody>;

function read(uid: string): Store {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key(uid)) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function write(uid: string, store: Store) {
  try {
    if (Object.keys(store).length) localStorage.setItem(key(uid), JSON.stringify(store));
    else localStorage.removeItem(key(uid));
  } catch {
    /* storage full or blocked: the saved reference still works, it just can't be read offline */
  }
}

export function loadSavedBody(uid: string, savedId: string): SavedBody | null {
  const entry = read(uid)[savedId];
  return entry && typeof entry.body === "string" ? entry : null;
}

export function hasSavedBody(uid: string, savedId: string): boolean {
  return loadSavedBody(uid, savedId) !== null;
}

export function storeSavedBody(uid: string, savedId: string, entry: SavedBody) {
  if (!entry.body) return;
  const all = read(uid);
  all[savedId] = { ...entry, body: entry.body.slice(0, MAX_BODY_CHARS) };
  write(uid, all);
}

export function removeSavedBody(uid: string, savedId: string) {
  const all = read(uid);
  if (!(savedId in all)) return;
  delete all[savedId];
  write(uid, all);
}

/** Removes every saved copy, for one user or (no argument) for everyone on this device. */
export function clearSavedBodies(uid?: string) {
  try {
    if (uid) return localStorage.removeItem(key(uid));
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* storage unavailable */
  }
}
