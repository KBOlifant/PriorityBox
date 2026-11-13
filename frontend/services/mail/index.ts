import { gmail } from "./gmail";
import { outlook } from "./outlook";
import { MailPager, type PageSource } from "./pager";
import {
  MailError,
  type AccountStatus,
  type ConnectedAccount,
  type MailProvider,
  type ProviderId,
} from "./types";

export * from "./types";
export { MailPager } from "./pager";

export const providers: Record<ProviderId, MailProvider> = { gmail, outlook };

/** Source ids look like "gmail:me@gmail.com". */
export const sourceId = (a: ConnectedAccount) => `${a.provider}:${a.email}`;

/**
 * Checks each connected account can be read, and builds a pager over the ones
 * that can. One account being unreachable never hides the others: it is
 * reported in `statuses` as needing a reconnect.
 */
export async function openPager(
  accounts: ConnectedAccount[],
  pageSize: number,
): Promise<{ pager: MailPager; statuses: AccountStatus[] }> {
  const checked = await Promise.all(
    accounts.map(async (a): Promise<AccountStatus> => {
      const provider = providers[a.provider];
      try {
        if (await provider.restore(a.email)) return { ...a, status: "ok" };
        return {
          ...a,
          status: "needs-reconnect",
          error: `${provider.label} needs to be reconnected.`,
        };
      } catch (err) {
        return {
          ...a,
          status: "needs-reconnect",
          error: err instanceof MailError ? err.message : "Couldn’t load your mail.",
        };
      }
    }),
  );

  const sources: PageSource[] = checked
    .filter((a) => a.status === "ok")
    .map((a) => ({
      id: sourceId(a),
      fetch: (cursor) =>
        providers[a.provider].fetchInbox(a.email, { limit: pageSize, cursor }),
    }));

  return { pager: new MailPager(sources, pageSize), statuses: checked };
}
