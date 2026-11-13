import type { AccountInfo, PublicClientApplication } from "@azure/msal-browser";
import { normalizeGraph, type GraphMessage } from "./parse";
import {
  MailError,
  type ConnectedAccount,
  type MailProvider,
} from "./types";

/**
 * Outlook / Microsoft 365 via MSAL (auth code + PKCE in the browser) and the
 * Microsoft Graph API. MSAL keeps tokens in sessionStorage and renews them
 * silently while the refresh token is valid.
 */

const SCOPES = ["Mail.Read", "User.Read"];
const GRAPH = "https://graph.microsoft.com/v1.0";

let app: Promise<PublicClientApplication> | null = null;

function client(): Promise<PublicClientApplication> {
  app ??= (async () => {
    const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
    if (!clientId) throw new MailError("Outlook sign-in isn’t configured yet.");
    const { PublicClientApplication } = await import("@azure/msal-browser");
    const instance = new PublicClientApplication({
      auth: {
        clientId,
        // Personal Outlook.com accounts and work/school accounts.
        authority: "https://login.microsoftonline.com/common",
        // Must be registered as a "Single-page application" redirect URI.
        redirectUri: `${window.location.origin}/auth/redirect`,
      },
      cache: { cacheLocation: "sessionStorage" },
    });
    await instance.initialize();
    return instance;
  })().catch((err) => {
    app = null;
    throw err;
  });
  return app;
}

function findAccount(instance: PublicClientApplication, email: string): AccountInfo | null {
  return (
    instance
      .getAllAccounts()
      .find((a) => a.username.toLowerCase() === email.toLowerCase()) ?? null
  );
}

function describeError(err: unknown): MailError {
  if (err instanceof MailError) return err;
  const code = (err as { errorCode?: string })?.errorCode ?? "";
  if (code === "user_cancelled") return new MailError("Sign-in was cancelled.");
  if (code === "popup_window_error" || code === "empty_window_error") {
    return new MailError("Outlook sign-in was blocked. Allow pop-ups and try again.");
  }
  return new MailError("Outlook sign-in failed. Try again.");
}

async function accessToken(email: string): Promise<string> {
  const instance = await client();
  const account = findAccount(instance, email);
  if (!account) throw new MailError("Outlook session expired. Reconnect to continue.");
  try {
    const result = await instance.acquireTokenSilent({ account, scopes: SCOPES });
    return result.accessToken;
  } catch {
    throw new MailError("Outlook session expired. Reconnect to continue.");
  }
}

export const outlook: MailProvider = {
  id: "outlook",
  label: "Microsoft Outlook",

  isConfigured: () => Boolean(process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID),

  async connect(): Promise<ConnectedAccount> {
    try {
      const instance = await client();
      const result = await instance.loginPopup({
        scopes: SCOPES,
        prompt: "select_account",
      });
      return { provider: "outlook", email: result.account.username };
    } catch (err) {
      throw describeError(err);
    }
  },

  async restore(account) {
    try {
      await accessToken(account);
      return true;
    } catch {
      return false;
    }
  },

  async fetchInbox(account, { limit, cursor }) {
    const token = await accessToken(account);
    const skip = Number(cursor) || 0;
    const query = [
      `$top=${limit}`,
      ...(skip ? [`$skip=${skip}`] : []),
      `$orderby=${encodeURIComponent("receivedDateTime desc")}`,
      `$select=${encodeURIComponent("id,subject,from,receivedDateTime,bodyPreview,body,webLink")}`,
    ].join("&");

    let res: Response;
    try {
      res = await fetch(`${GRAPH}/me/mailFolders/inbox/messages?${query}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          // Ask for plain text so we don't have to strip HTML ourselves.
          Prefer: 'outlook.body-content-type="text"',
        },
      });
    } catch {
      throw new MailError("Can’t reach Outlook. Check your connection.");
    }
    if (res.status === 401) {
      throw new MailError("Outlook session expired. Reconnect to continue.");
    }
    if (res.status === 403) {
      throw new MailError(
        "Outlook refused access. Check the app has the Mail.Read permission.",
      );
    }
    if (res.status === 429) {
      throw new MailError("Outlook is rate limiting requests. Try again shortly.");
    }
    if (!res.ok) throw new MailError("Outlook returned an error. Try again.");

    const data = (await res.json()) as {
      value?: GraphMessage[];
      "@odata.nextLink"?: string;
    };
    return {
      mail: (data.value ?? []).map((m) => normalizeGraph(m, account)),
      // Graph signals "more" with a nextLink; we page with $skip instead of following it.
      next: data["@odata.nextLink"] ? String(skip + limit) : undefined,
    };
  },

  async disconnect(account) {
    const instance = await client();
    const found = findAccount(instance, account);
    if (found) await instance.clearCache({ account: found });
  },
};
