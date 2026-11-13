import { normalizeGmail, type GmailMessage } from "./parse";
import {
  MailError,
  type ConnectedAccount,
  type MailProvider,
  type RawMail,
} from "./types";

/**
 * Gmail via Google Identity Services (browser OAuth, no backend).
 * Tokens last about an hour and live in sessionStorage; after that we try to
 * renew silently and otherwise ask the user to reconnect.
 */

const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_KEY = "priority:gmail-token";
const FETCH_CONCURRENCY = 8;

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
}
interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; hint?: string }): void;
}
interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string }) => void;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: TokenClientConfig): TokenClient;
          revoke(token: string, done?: () => void): void;
        };
      };
    };
  }
}

let gisScript: Promise<void> | null = null;

function loadGis(): Promise<void> {
  gisScript ??= new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisScript = null;
      reject(new MailError("Couldn’t load Google sign-in. Check your connection."));
    };
    document.head.appendChild(script);
  });
  return gisScript;
}

function saveToken(token: string, expiresInSeconds: number) {
  try {
    sessionStorage.setItem(
      TOKEN_KEY,
      JSON.stringify({ token, expires: Date.now() + expiresInSeconds * 1000 }),
    );
  } catch {
    /* storage blocked: we just won't be able to reuse it */
  }
}

function cachedToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, expires } = JSON.parse(raw) as { token: string; expires: number };
    return expires - 60_000 > Date.now() ? token : null;
  } catch {
    return null;
  }
}

function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function requestToken(prompt: string, hint?: string): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return Promise.reject(new MailError("Google sign-in isn’t configured yet."));
  }
  return loadGis().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const client = window.google!.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          callback: (r) => {
            if (r.access_token) {
              saveToken(r.access_token, Number(r.expires_in) || 3600);
              resolve(r.access_token);
            } else {
              reject(
                new MailError(
                  r.error === "access_denied"
                    ? "Gmail access was declined."
                    : "Google sign-in failed. Try again.",
                ),
              );
            }
          },
          error_callback: (e) =>
            reject(
              new MailError(
                e.type === "popup_closed"
                  ? "Sign-in was cancelled."
                  : "Google sign-in was blocked. Allow pop-ups and try again.",
              ),
            ),
        });
        client.requestAccessToken({ prompt, hint });
      }),
  );
}

async function api<T>(path: string, token: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new MailError("Can’t reach Gmail. Check your connection.");
  }
  if (res.status === 401) {
    clearToken();
    throw new MailError("Gmail session expired. Reconnect to continue.");
  }
  if (res.status === 403) {
    throw new MailError(
      "Gmail refused access. Make sure the Gmail API is enabled and this account is a test user.",
    );
  }
  if (res.status === 429) {
    throw new MailError("Gmail is rate limiting requests. Try again shortly.");
  }
  if (!res.ok) throw new MailError("Gmail returned an error. Try again.");
  return (await res.json()) as T;
}

export const gmail: MailProvider = {
  id: "gmail",
  label: "Google Gmail",

  isConfigured: () => Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),

  async connect(): Promise<ConnectedAccount> {
    const token = await requestToken("select_account");
    const profile = await api<{ emailAddress: string }>("/profile", token);
    return { provider: "gmail", email: profile.emailAddress };
  },

  async restore(account) {
    if (cachedToken()) return true;
    try {
      await requestToken("", account);
      return true;
    } catch {
      return false;
    }
  },

  async fetchInbox(account, { limit, cursor }) {
    const token = cachedToken();
    if (!token) throw new MailError("Gmail session expired. Reconnect to continue.");

    const page = cursor ? `&pageToken=${encodeURIComponent(cursor)}` : "";
    const list = await api<{ messages?: { id: string }[]; nextPageToken?: string }>(
      `/messages?maxResults=${limit}&labelIds=INBOX${page}`,
      token,
    );
    const ids = (list.messages ?? []).map((m) => m.id);

    const mail: RawMail[] = [];
    for (let i = 0; i < ids.length; i += FETCH_CONCURRENCY) {
      const batch = ids.slice(i, i + FETCH_CONCURRENCY);
      const messages = await Promise.all(
        batch.map((id) => api<GmailMessage>(`/messages/${id}?format=full`, token)),
      );
      mail.push(...messages.map((m) => normalizeGmail(m, account)));
    }
    return { mail, next: list.nextPageToken };
  },

  async disconnect() {
    const token = cachedToken();
    clearToken();
    if (token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token);
    }
  },
};
