import * as crud from "./crud";
import type { Stored } from "./crud";
import { USERS } from "./users";

/**
 * Folders of grouped emails ("Grouped Emails" in the workspace):
 *   users/{uid}/folders/{folderId}                 the folder
 *   users/{uid}/folders/{folderId}/items/{msgId}   one email in it
 *
 * Like saved emails these are REFERENCES: which message it is and just enough
 * (sender, subject, date) to list it. The body is fetched by id when opened and
 * kept on this device only (IndexedDB), never in Firestore.
 */
export interface Folder {
  name: string;
  /** The AI instruction that produced the group, shown as the folder's description. */
  instruction: string;
  count: number;
  /** Epoch ms. (Not `createdAt`: crud's own server timestamp uses that name.) */
  created: number;
}

export interface FolderItem {
  provider: "gmail" | "outlook";
  account: string;
  /** Full message id as used in the app, e.g. "gmail:18c2f…". */
  messageId: string;
  webLink: string;
  sender: string;
  senderEmail: string;
  subject: string;
  /** Epoch ms the email was received. */
  receivedAt: number;
  /** Epoch ms it was added to the folder. */
  addedAt: number;
}

export type FolderRef = Folder & { id: string };
export type FolderItemRef = FolderItem & { id: string };

const foldersPath = (uid: string) => `${USERS}/${uid}/folders`;
const itemsPath = (uid: string, folderId: string) => `${foldersPath(uid)}/${folderId}/items`;
/** Firestore ids can't contain "/". */
export const itemDocId = (messageId: string) => messageId.replace(/\//g, "_");

const toFolder = (d: Stored<Folder>): FolderRef => ({
  id: d.id,
  name: d.name,
  instruction: d.instruction ?? "",
  count: typeof d.count === "number" ? d.count : 0,
  created: d.created ?? 0,
});

const toItem = (d: Stored<FolderItem>): FolderItemRef => ({
  id: d.id,
  provider: d.provider,
  account: d.account,
  messageId: d.messageId,
  webLink: d.webLink ?? "",
  sender: d.sender,
  senderEmail: d.senderEmail ?? "",
  subject: d.subject,
  receivedAt: d.receivedAt ?? 0,
  addedAt: d.addedAt ?? 0,
});

export async function listFolders(uid: string): Promise<FolderRef[]> {
  return (await crud.list<Folder>(foldersPath(uid))).map(toFolder);
}

/** The folders kept on this device: instant, and works without a connection. */
export async function listFoldersCached(uid: string): Promise<FolderRef[]> {
  return (await crud.listFromCache<Folder>(foldersPath(uid))).map(toFolder);
}

/** A fresh folder id, so a new folder can be shown before the server confirms it. */
export const newFolderId = (uid: string) => crud.newId(foldersPath(uid));

export const saveFolder = (uid: string, id: string, folder: Folder) =>
  crud.upsert<Folder>(foldersPath(uid), id, folder);

export const updateFolder = (uid: string, id: string, patch: Partial<Folder>) =>
  crud.upsert<Folder>(foldersPath(uid), id, patch);

export async function listFolderItems(uid: string, folderId: string): Promise<FolderItemRef[]> {
  return (await crud.list<FolderItem>(itemsPath(uid, folderId))).map(toItem);
}

export async function saveFolderItems(uid: string, folderId: string, items: FolderItem[]) {
  await Promise.all(
    items.map((item) => crud.upsert<FolderItem>(itemsPath(uid, folderId), itemDocId(item.messageId), item)),
  );
}

export const removeFolderItem = (uid: string, folderId: string, itemId: string) =>
  crud.remove(itemsPath(uid, folderId), itemId);

/** Deletes the folder and every item in it (Firestore doesn't delete subcollections by itself). */
export async function deleteFolder(uid: string, folderId: string) {
  const items = await crud.list<FolderItem>(itemsPath(uid, folderId));
  await Promise.all(items.map((i) => crud.remove(itemsPath(uid, folderId), i.id)));
  await crud.remove(foldersPath(uid), folderId);
}
