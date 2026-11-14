import { cache, cacheKey } from "../cache";
import * as crud from "./crud";
import { USERS } from "./users";
import type { ConnectedAccount, ProviderId } from "../mail/types";

/**
 * Which mail accounts a user has connected: users/{uid}/mailAccounts/{provider}.
 * Only the address is stored. OAuth tokens never leave the browser.
 */
type AccountDoc = { email: string };

const path = (uid: string) => `${USERS}/${uid}/mailAccounts`;

const ACCOUNTS_TTL_SECONDS = 3600;
const accountsKey = (uid: string) => cacheKey(uid, "accounts");

export async function saveMailAccount(uid: string, account: ConnectedAccount) {
  await crud.upsert<AccountDoc>(path(uid), account.provider, { email: account.email });
  await cache.del(accountsKey(uid));
}

/** Cached: this is read on every launch and sync, and changes only on connect / disconnect. */
export async function listMailAccounts(uid: string): Promise<ConnectedAccount[]> {
  const cached = await cache.get<ConnectedAccount[]>(accountsKey(uid));
  if (cached) return cached;

  const docs = await crud.list<AccountDoc>(path(uid));
  const accounts = docs
    .filter((d) => d.id === "gmail" || d.id === "outlook")
    .map((d) => ({ provider: d.id as ProviderId, email: d.email }));
  await cache.set(accountsKey(uid), accounts, ACCOUNTS_TTL_SECONDS);
  return accounts;
}

export async function removeMailAccount(uid: string, provider: ProviderId) {
  await crud.remove(path(uid), provider);
  await cache.del(accountsKey(uid));
}
