import { COLORS, hash, initials, when } from "./mail-map";
import { actions, getSaved } from "./store";
import { formatEventDate } from "@/services/mail/classifyParse";
import * as store from "@/services/firestore";
import { savedDocId, type SavedRef } from "@/services/firestore/savedEmails";
import { safely, withTimeout } from "@/services/safely";
import { rate, type ManualInput } from "./manual";
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
    senderEmail: m.email,
    subject: m.subject,
    priority: m.priority,
    activity: m.subject,
    eventDate: m.eventIso ?? "",
    progressNote: "",
    remarks: m.remarks,
    stage: m.progress.stage,
    percent: m.progress.percent,
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

/**
 * Saves the user's edits to a saved email (same form as a manual entry). The AI
 * rates the progress again only if something that affects it changed, and a
 * failed rating never wipes a good one.
 */
export async function editSavedEntry(
  uid: string,
  id: string,
  input: ManualInput,
): Promise<{ rated: boolean }> {
  const existing = getSaved().find((s) => s.id === id);
  if (!existing) throw new Error("That saved email no longer exists.");

  const changed =
    input.activity !== existing.activity ||
    input.eventDate !== existing.eventDate ||
    input.progressNote !== existing.progressNote;
  const rating = changed
    ? await rate(input)
    : { stage: existing.stage, percent: existing.percent, rated: true };
  const keep = changed && !rating.rated;
  const patch = {
    ...input,
    stage: keep ? existing.stage : rating.stage,
    percent: keep ? existing.percent : rating.percent,
  };

  await withTimeout(store.updateSavedEmail(uid, existing.messageId, patch), 10_000);
  actions.upsertSaved({ ...existing, ...patch });
  return { rated: rating.rated };
}

/** Quick edits made straight on the card (priority). Shown at once, saved in the background. */
export async function updateSavedFields(
  uid: string,
  id: string,
  patch: Partial<Pick<SavedRef, "priority">>,
) {
  const existing = getSaved().find((s) => s.id === id);
  if (!existing) return;
  actions.upsertSaved({ ...existing, ...patch });
  await safely("save saved-email edit", () => store.updateSavedEmail(uid, existing.messageId, patch));
}

/**
 * A saved email as a Message, so every AI feature (summary, follow-up) works on it
 * exactly as on a loaded email. The email body isn't stored, so the AI works from
 * the user's own notes, plus the real body when it is known (the email is loaded
 * in this session, or the user opened it with "Read email").
 */
export function savedToMessage(s: SavedRef, body?: string): Message {
  const notes = [
    s.activity && s.activity !== s.subject ? `Activity: ${s.activity}` : "",
    s.progressNote ? `Progress: ${s.progressNote}` : "",
    s.remarks ? `Remarks: ${s.remarks}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    // The same id as the original email, so stored summaries and drafts are shared with it.
    id: s.messageId,
    sender: s.sender,
    email: s.senderEmail,
    initials: initials(s.sender, s.sender),
    avatarColor: COLORS[hash(s.sender) % COLORS.length],
    ...when(s.savedAt),
    subject: s.subject,
    preview: notes || s.subject,
    body,
    event: s.eventDate ? { label: "Event date", date: formatEventDate(s.eventDate) } : undefined,
    priority: s.priority,
    waiting: s.percent < 100,
    archived: false,
    progress: { stage: s.stage, percent: s.percent },
    tags: [],
    remarks: s.remarks,
    provider: s.provider,
    account: s.account,
    webLink: s.webLink,
  };
}
