import { idbClearPrefix, idbGet, idbGetMany, idbSet, idbSetMany } from "./idb";
import { providers } from "./mail";
import type { RawMail } from "./mail/types";

/**
 * Emails kept on this device (IndexedDB) so the same message is fetched from
 * Gmail / Outlook once, not every time the AI searches, a folder is opened or
 * an older email is shown again:
 *
 *   getMail:  IndexedDB -> mailbox API (then written back)
 *   search:   id list cached for a few minutes per query
 *
 * Cleared on sign-out and when an account is disconnected.
 */

/** Emails don't change, so a copy can live for days; it only saves API calls. */
const MAIL_TTL_SECONDS = 3 * 24 * 3600;
/** New mail arrives, so a search result is only reused briefly. */
const SEARCH_TTL_SECONDS = 15 * 60;
const FETCH_CONCURRENCY = 8;

const mailKey = (uid: string, id: string) => `mail:${uid}:${id}`;
const searchKey = (uid: string, key: string) => `msearch:${uid}:${key}`;

/** Keeps these emails on this device. */
export async function storeMail(uid: string, mail: RawMail[]) {
  await idbSetMany(
    mail.map((m) => ({ key: mailKey(uid, m.id), value: m })),
    MAIL_TTL_SECONDS,
  );
}

/** The copies kept on this device, by full id ("gmail:…"). Missing ones are left out. */
export async function loadStoredMail(uid: string, ids: string[]): Promise<Map<string, RawMail>> {
  const hits = await idbGetMany<RawMail>(ids.map((id) => mailKey(uid, id)));
  const out = new Map<string, RawMail>();
  ids.forEach((id, i) => {
    if (hits[i]) out.set(id, hits[i]!);
  });
  return out;
}

/**
 * Emails by full id, from this device where possible and from the mailbox
 * otherwise. Emails that can't be fetched (deleted, no access) are left out.
 */
export async function getMail(uid: string, account: string, ids: string[]): Promise<RawMail[]> {
  const kept = await loadStoredMail(uid, ids);
  const missing = ids.filter((id) => !kept.has(id));

  const fetched: RawMail[] = [];
  for (let i = 0; i < missing.length; i += FETCH_CONCURRENCY) {
    const batch = missing.slice(i, i + FETCH_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (id) => {
        const provider = providers[id.startsWith("outlook:") ? "outlook" : "gmail"];
        try {
          return await provider.fetchMessage(account, id.slice(id.indexOf(":") + 1));
        } catch {
          return null;
        }
      }),
    );
    fetched.push(...results.filter((m): m is RawMail => m !== null));
  }
  if (fetched.length) void storeMail(uid, fetched);

  const byId = new Map([...kept, ...fetched.map((m) => [m.id, m] as const)]);
  return ids.map((id) => byId.get(id)).filter((m): m is RawMail => !!m);
}

/** A cached list of ids for a search, or null when it hasn't been run recently. */
export const loadSearch = (uid: string, key: string) => idbGet<string[]>(searchKey(uid, key));

export const storeSearch = (uid: string, key: string, ids: string[]) =>
  idbSet(searchKey(uid, key), ids, SEARCH_TTL_SECONDS);

/** Forgets every email and search kept for this user. */
export async function clearStoredMail(uid: string) {
  await Promise.all([idbClearPrefix(`mail:${uid}:`), idbClearPrefix(`msearch:${uid}:`)]);
}
