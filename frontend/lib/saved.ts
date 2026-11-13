import { COLORS, hash, initials, when } from "./mail-map";
import { actions, getSaved } from "./store";
import { formatEventDate } from "@/services/mail/classifyParse";
import * as store from "@/services/firestore";
import { savedDocId, type SavedRef } from "@/services/firestore/savedEmails";
import { inBackground, safely } from "@/services/safely";
import { hasSavedBody, removeSavedBody, storeSavedBody } from "@/services/savedBodies";
import { isOnline } from "./online";
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

/**
 * Shows the saved emails kept on this device straight away, then brings them up
 * to date from the server if it can be reached. They don't depend on a mailbox
 * being connected: a saved email stays until the user removes it.
 */
export async function loadSaved(uid: string) {
  const cached = await store.listSavedEmailsCached(uid);
  // Auto-save waits until the list is complete, so it can't re-add or overwrite anything; a
  // device copy counts as complete only when the server can't be asked.
  if (cached.length) actions.setSaved(cached, !isOnline());
  const list = await safely("load saved emails", () => store.listSavedEmails(uid));
  if (list) actions.setSaved(list);
}

/** Keeps a copy of the email's text on this device so it can be read without the inbox. */
export function keepBody(uid: string, m: Message) {
  if (m.body) storeSavedBody(uid, savedDocId(m.id), { body: m.body, day: m.day, time: m.time });
}

/** Saved emails whose message is loaded right now but whose text isn't kept yet (saved before this existed). */
export function missingBodies(uid: string, messages: Message[], saved: SavedRef[]): Message[] {
  const live = new Map(messages.map((m) => [savedDocId(m.id), m]));
  return saved
    .filter((s) => !s.removed && !hasSavedBody(uid, s.id))
    .map((s) => live.get(s.id))
    .filter((m): m is Message => !!m?.body);
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
export function saveMessage(uid: string, m: Message, auto = false) {
  if (!isSavable(m)) return;
  const ref = refFor(m, auto);
  actions.upsertSaved(ref);
  keepBody(uid, m);
  const { id, ...doc } = ref;
  void id;
  inBackground("save email reference", store.saveEmailRef(uid, doc));
}

export function unsaveMessage(uid: string, messageId: string) {
  const ref = getSaved().find((s) => s.id === savedDocId(messageId));
  if (!ref) return;
  actions.upsertSaved({ ...ref, removed: true });
  removeSavedBody(uid, ref.id);
  inBackground("remove email reference", store.removeEmailRef(uid, ref.messageId));
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

  inBackground("update saved email", store.updateSavedEmail(uid, existing.messageId, patch));
  actions.upsertSaved({ ...existing, ...patch });
  return { rated: rating.rated };
}

/** Quick edits made straight on the card (priority). Shown at once, saved in the background. */
export function updateSavedFields(
  uid: string,
  id: string,
  patch: Partial<Pick<SavedRef, "priority">>,
) {
  const existing = getSaved().find((s) => s.id === id);
  if (!existing) return;
  actions.upsertSaved({ ...existing, ...patch });
  inBackground("save saved-email edit", store.updateSavedEmail(uid, existing.messageId, patch));
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
