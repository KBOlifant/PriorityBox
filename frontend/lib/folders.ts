import { actions, getFolders } from "./store";
import type { Message } from "./types";
import * as store from "@/services/firestore";
import type { FolderItem, FolderItemRef, FolderRef } from "@/services/firestore/folders";
import { itemDocId } from "@/services/firestore/folders";
import { storeMail } from "@/services/mailStore";
import type { RawMail } from "@/services/mail/types";
import { inBackground, safely } from "@/services/safely";

/**
 * "Grouped Emails": folders the user saves from an AI result. Firestore keeps the
 * folder and a reference per email; the bodies are kept on this device
 * (IndexedDB) so opening a folder doesn't have to call the mailbox again.
 */

/** Only real mail can go in a folder: sample and manual cards have nothing to fetch later. */
export const isFolderable = (m: Message): m is Message & { provider: "gmail" | "outlook"; account: string } =>
  (m.provider === "gmail" || m.provider === "outlook") && !!m.account;

const byNewest = (a: FolderRef, b: FolderRef) => b.created - a.created;

function toItem(m: Message & { provider: "gmail" | "outlook"; account: string }): FolderItem {
  return {
    provider: m.provider,
    account: m.account,
    messageId: m.id,
    webLink: m.webLink ?? "",
    sender: m.sender,
    senderEmail: m.email,
    subject: m.subject,
    receivedAt: m.receivedAt ?? 0,
    addedAt: Date.now(),
  };
}

function toRaw(m: Message & { provider: "gmail" | "outlook"; account: string }): RawMail {
  return {
    id: m.id,
    provider: m.provider,
    account: m.account,
    fromName: m.sender,
    fromEmail: m.email,
    subject: m.subject,
    body: m.body ?? "",
    receivedAt: m.receivedAt ?? 0,
    webLink: m.webLink,
  };
}

/** Keeps the bodies on this device so the folder opens without asking the mailbox. */
function keepBodies(uid: string, messages: Message[]) {
  const withBody = messages.filter(isFolderable).filter((m) => m.body);
  if (withBody.length) void storeMail(uid, withBody.map(toRaw));
}

/** Loads the folder list: the device copy first (instant), then the server's. */
export async function loadFolders(uid: string) {
  const cached = await safely("list cached folders", () => store.listFoldersCached(uid));
  if (cached?.length) actions.setFolders(cached.sort(byNewest), false);
  const fresh = await safely("list folders", () => store.listFolders(uid));
  if (fresh) actions.setFolders(fresh.sort(byNewest));
}

export async function loadFolderItems(uid: string, folderId: string) {
  const items = await safely("list folder items", () => store.listFolderItems(uid, folderId));
  if (items) actions.setFolderItems(folderId, items.sort((a, b) => b.receivedAt - a.receivedAt));
}

function setCount(folderId: string, count: number) {
  const { folders } = getFolders();
  actions.setFolders(folders.map((f) => (f.id === folderId ? { ...f, count } : f)));
}

/** Creates a folder holding these emails. Returns its id, or null if nothing could be saved. */
export async function createFolder(
  uid: string,
  name: string,
  instruction: string,
  messages: Message[],
): Promise<string | null> {
  const emails = messages.filter(isFolderable);
  if (!emails.length) return null;
  const id = store.newFolderId(uid);
  const folder = { name: name.trim().slice(0, 60) || "Grouped emails", instruction, count: emails.length, created: Date.now() };
  const items = emails.map(toItem);

  // Shown straight away; Firestore confirms in the background.
  const { folders } = getFolders();
  actions.setFolders([{ ...folder, id }, ...folders]);
  actions.setFolderItems(id, items.map((i) => ({ ...i, id: itemDocId(i.messageId) })));
  keepBodies(uid, emails);

  // Firestore keeps the write on this device and sends it when it can, so a slow
  // or offline save still ends up stored; only a real failure is logged.
  inBackground(
    "create folder",
    (async () => {
      await store.saveFolder(uid, id, folder);
      await store.saveFolderItems(uid, id, items);
    })(),
  );
  return id;
}

/** Adds emails to an existing folder (ones already in it are skipped). Returns how many were added. */
export async function addToFolder(uid: string, folderId: string, messages: Message[]): Promise<number> {
  const { items } = getFolders();
  const current = items[folderId] ?? (await safely("list folder items", () => store.listFolderItems(uid, folderId))) ?? [];
  const have = new Set(current.map((i) => i.messageId));
  const fresh = messages.filter(isFolderable).filter((m) => !have.has(m.id)).map(toItem);
  if (!fresh.length) return 0;

  const next: FolderItemRef[] = [...current, ...fresh.map((i) => ({ ...i, id: itemDocId(i.messageId) }))];
  actions.setFolderItems(folderId, next.sort((a, b) => b.receivedAt - a.receivedAt));
  setCount(folderId, next.length);
  keepBodies(uid, messages);

  await safely("add to folder", async () => {
    await store.saveFolderItems(uid, folderId, fresh);
    await store.updateFolder(uid, folderId, { count: next.length });
  });
  return fresh.length;
}

export async function removeFromFolder(uid: string, folderId: string, itemId: string) {
  const { items } = getFolders();
  const next = (items[folderId] ?? []).filter((i) => i.id !== itemId);
  actions.setFolderItems(folderId, next);
  setCount(folderId, next.length);
  await safely("remove from folder", async () => {
    await store.removeFolderItem(uid, folderId, itemId);
    await store.updateFolder(uid, folderId, { count: next.length });
  });
}

export async function renameFolder(uid: string, folderId: string, name: string) {
  const clean = name.trim().slice(0, 60);
  if (!clean) return;
  const { folders } = getFolders();
  actions.setFolders(folders.map((f) => (f.id === folderId ? { ...f, name: clean } : f)));
  await safely("rename folder", () => store.updateFolder(uid, folderId, { name: clean }));
}

export async function deleteFolder(uid: string, folderId: string) {
  const { folders } = getFolders();
  actions.setFolders(folders.filter((f) => f.id !== folderId));
  await safely("delete folder", () => store.deleteFolder(uid, folderId));
}
