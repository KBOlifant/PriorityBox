export type ProviderId = "gmail" | "outlook";

/** A mail account the user has connected. */
export interface ConnectedAccount {
  provider: ProviderId;
  email: string;
}

/** A connected account plus whether we can currently read its mail. */
export interface AccountStatus extends ConnectedAccount {
  status: "ok" | "needs-reconnect";
  error?: string;
}

/** One inbox message, normalised from either provider. */
export interface RawMail {
  /** Globally unique: "gmail:<id>" or "outlook:<id>". */
  id: string;
  provider: ProviderId;
  /** The connected account this message belongs to. */
  account: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  /** Plain-text body, quoted replies stripped and length capped. */
  body: string;
  /** Epoch ms. */
  receivedAt: number;
  /** Opens the message in the provider's web mail. */
  webLink?: string;
}

/** AI-derived fields that the real mailboxes don't provide. */
export interface Classification {
  priority: "High" | "Medium" | "Low";
  waiting: boolean;
  event?: { label: string; date: string };
  stage: string;
  percent: number;
  tags: string[];
}

/** Raised with a message that is safe to show to the user. */
export class MailError extends Error {}

export interface MailProvider {
  id: ProviderId;
  label: string;
  /** False when the OAuth client id isn't set in .env. */
  isConfigured(): boolean;
  /** Interactive sign-in. Must be called from a user gesture (click). */
  connect(): Promise<ConnectedAccount>;
  /** Tries to get a valid token without UI. Returns false if the user must reconnect. */
  restore(account: string): Promise<boolean>;
  fetchInbox(account: string, limit: number): Promise<RawMail[]>;
  disconnect(account: string): Promise<void>;
}
