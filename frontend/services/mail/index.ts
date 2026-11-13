import { gmail } from "./gmail";
import { outlook } from "./outlook";
import {
  MailError,
  type AccountStatus,
  type ConnectedAccount,
  type MailProvider,
  type ProviderId,
  type RawMail,
} from "./types";

export * from "./types";

export const providers: Record<ProviderId, MailProvider> = { gmail, outlook };

/**
 * Loads the inbox of every connected account. One account failing (expired
 * session, revoked access) never hides the others: it is reported in `statuses`.
 */
export async function loadMail(
  accounts: ConnectedAccount[],
  limit: number,
): Promise<{ mail: RawMail[]; statuses: AccountStatus[] }> {
  const results = await Promise.all(
    accounts.map(async (a): Promise<{ status: AccountStatus; mail: RawMail[] }> => {
      const provider = providers[a.provider];
      try {
        if (!(await provider.restore(a.email))) {
          return {
            status: {
              ...a,
              status: "needs-reconnect",
              error: `${provider.label} needs to be reconnected.`,
            },
            mail: [],
          };
        }
        return {
          status: { ...a, status: "ok" },
          mail: await provider.fetchInbox(a.email, limit),
        };
      } catch (err) {
        return {
          status: {
            ...a,
            status: "needs-reconnect",
            error: err instanceof MailError ? err.message : "Couldn’t load your mail.",
          },
          mail: [],
        };
      }
    }),
  );

  return {
    mail: results.flatMap((r) => r.mail).sort((a, b) => b.receivedAt - a.receivedAt),
    statuses: results.map((r) => r.status),
  };
}
