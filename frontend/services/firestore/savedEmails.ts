import * as crud from "./crud";
import type { Stored } from "./crud";
import { USERS } from "./users";
import type { Priority } from "@/lib/types";

/**
 * Emails the user wants to come back to: users/{uid}/savedEmails/{id}.
 * This is a REFERENCE, not the email: which message it is, where to open it, and
 * just enough (sender and subject) to recognise it in a list. The body is never stored.
 *
 * On top of that it carries the same editable fields as a manual entry, so a saved
 * email can be tracked and edited the same way. Those are the user's own words.
 */
export interface SavedEmail {
  provider: "gmail" | "outlook";
  /** The connected account's address. */
  account: string;
  /** Full message id as used in the app, e.g. "gmail:18c2f…". */
  messageId: string;
  webLink?: string;
  sender: string;
  /** The sender's address, so a follow-up can be started in the user's mail app. */
  senderEmail: string;
  subject: string;
  priority: Priority;
  /** What the email is about. Starts as the subject and can be edited. */
  activity: string;
  /** YYYY-MM-DD, or "" when there is no event. */
  eventDate: string;
  /** The user's own comment on how it is going. */
  progressNote: string;
  remarks: string;
  /** Decided by the AI from the progress comment. */
  stage: string;
  percent: number;
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

const fromDoc = (d: Stored<SavedEmail>): SavedRef => ({
  id: d.id,
  provider: d.provider,
  account: d.account,
  messageId: d.messageId,
  webLink: d.webLink,
  sender: d.sender,
  senderEmail: d.senderEmail ?? "",
  subject: d.subject,
  priority: d.priority,
  // Items saved before these fields existed fall back to sensible defaults.
  activity: d.activity || d.subject,
  eventDate: d.eventDate ?? "",
  progressNote: d.progressNote ?? "",
  remarks: d.remarks ?? "",
  stage: d.stage ?? "Not rated",
  percent: typeof d.percent === "number" ? d.percent : 0,
  auto: !!d.auto,
  removed: !!d.removed,
  savedAt: d.savedAt ?? 0,
});

export async function listSavedEmails(uid: string): Promise<SavedRef[]> {
  return (await crud.list<SavedEmail>(path(uid))).map(fromDoc);
}

/** The saved emails kept on this device: instant, and works without a connection. */
export async function listSavedEmailsCached(uid: string): Promise<SavedRef[]> {
  return (await crud.listFromCache<SavedEmail>(path(uid))).map(fromDoc);
}

export const saveEmailRef = (uid: string, ref: SavedEmail) =>
  crud.upsert<SavedEmail>(path(uid), savedDocId(ref.messageId), {
    ...ref,
    // Firestore rejects undefined fields.
    webLink: ref.webLink ?? "",
  });

/** Updates only the given fields of a saved email. */
export const updateSavedEmail = (uid: string, messageId: string, patch: Partial<SavedEmail>) =>
  crud.upsert<SavedEmail>(path(uid), savedDocId(messageId), patch);

/** Takes it off the list but keeps a marker, so auto-save won't re-add it. */
export const removeEmailRef = (uid: string, messageId: string) =>
  crud.upsert<SavedEmail>(path(uid), savedDocId(messageId), { removed: true });
