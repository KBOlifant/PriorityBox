import { actions, getSaved } from "./store";
import * as store from "@/services/firestore";
import { savedDocId, type SavedRef } from "@/services/firestore/savedEmails";
import { safely } from "@/services/safely";
import type { Message } from "./types";

/** Real mail only: sample and manual items have nothing in a mailbox to point to. */
export const isSavable = (m: Message) =>
  (m.provider === "gmail" || m.provider === "outlook") && !!m.account;

/** High priority emails that nobody has saved (or removed) yet. */
export function missingAutoSaves(messages: Message[], saved: SavedRef[]): Message[] {
  const known = new Set(saved.map((s) => s.id));
  return messages.filter(
    (m) => isSavable(m) && m.priority === "High" && !m.archived && !known.has(savedDocId(m.id)),
  );
}

export async function loadSaved(uid: string) {
  const list = await safely("load saved emails", () => store.listSavedEmails(uid));
  if (list) actions.setSaved(list);
}

function refFor(m: Message, auto: boolean): SavedRef {
  return {
    id: savedDocId(m.id),
    provider: m.provider as "gmail" | "outlook",
    account: m.account as string,
    messageId: m.id,
    webLink: m.webLink,
    sender: m.sender,
    subject: m.subject,
    priority: m.priority,
    auto,
    removed: false,
    savedAt: Date.now(),
  };
}

/** Saves a reference (sender, subject and where to open it) and shows it straight away. */
export async function saveMessage(uid: string, m: Message, auto = false) {
  if (!isSavable(m)) return;
  const ref = refFor(m, auto);
  actions.upsertSaved(ref);
  const { id, ...doc } = ref;
  void id;
  await safely("save email reference", () => store.saveEmailRef(uid, doc));
}

export async function unsaveMessage(uid: string, messageId: string) {
  const ref = getSaved().find((s) => s.id === savedDocId(messageId));
  if (!ref) return;
  actions.upsertSaved({ ...ref, removed: true });
  await safely("remove email reference", () => store.removeEmailRef(uid, ref.messageId));
}
