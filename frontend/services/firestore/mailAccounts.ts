import * as crud from "./crud";
import { USERS } from "./users";
import type { ConnectedAccount, ProviderId } from "../mail/types";

/**
 * Which mail accounts a user has connected: users/{uid}/mailAccounts/{provider}.
 * Only the address is stored. OAuth tokens never leave the browser.
 */
type AccountDoc = { email: string };

const path = (uid: string) => `${USERS}/${uid}/mailAccounts`;

export const saveMailAccount = (uid: string, account: ConnectedAccount) =>
  crud.upsert<AccountDoc>(path(uid), account.provider, { email: account.email });

export async function listMailAccounts(uid: string): Promise<ConnectedAccount[]> {
  const docs = await crud.list<AccountDoc>(path(uid));
  return docs
    .filter((d) => d.id === "gmail" || d.id === "outlook")
    .map((d) => ({ provider: d.id as ProviderId, email: d.email }));
}

export const removeMailAccount = (uid: string, provider: ProviderId) =>
  crud.remove(path(uid), provider);
