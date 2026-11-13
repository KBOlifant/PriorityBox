import * as crud from "./crud";
import { USERS } from "./users";
import type { Priority } from "@/lib/types";

/**
 * Emails the user wants to come back to: users/{uid}/savedEmails/{id}.
 * This is a REFERENCE, not the email: which message it is, where to open it, and
 * just enough (sender and subject) to recognise it in a list. The body is never stored.
 */
export interface SavedEmail {
  provider: "gmail" | "outlook";
  /** The connected account's address. */
  account: string;
  /** Full message id as used in the app, e.g. "gmail:18c2f…". */
  messageId: string;
  webLink?: string;
  sender: string;
  subject: string;
  priority: Priority;
  /** Saved automatically because it was High priority, rather than by the user. */
  auto: boolean;
  /** The user took it off the list. Kept so auto-save doesn't bring it back. */
  removed: boolean;
  /** Epoch ms. */
  savedAt: number;
}

export type SavedRef = SavedEmail & { id: string };

const path = (uid: string) => `${USERS}/${uid}/savedEmails`;

/** Firestore ids can't contain "/". */
export const savedDocId = (messageId: string) => messageId.replace(/\//g, "_");

export async function listSavedEmails(uid: string): Promise<SavedRef[]> {
  const docs = await crud.list<SavedEmail>(path(uid));
  return docs.map(({ id, provider, account, messageId, webLink, sender, subject, priority, auto, removed, savedAt }) => ({
    id, provider, account, messageId, webLink, sender, subject, priority,
    auto: !!auto, removed: !!removed, savedAt: savedAt ?? 0,
  }));
}

export const saveEmailRef = (uid: string, ref: SavedEmail) =>
  crud.upsert<SavedEmail>(path(uid), savedDocId(ref.messageId), {
    ...ref,
    // Firestore rejects undefined fields.
    webLink: ref.webLink ?? "",
  });

/** Takes it off the list but keeps a marker, so auto-save won't re-add it. */
export const removeEmailRef = (uid: string, messageId: string) =>
  crud.upsert<SavedEmail>(path(uid), savedDocId(messageId), { removed: true });
