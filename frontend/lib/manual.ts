import { actions, getManual, type ManualEdit } from "./store";
import * as store from "@/services/firestore";
import type { ManualEntry, ManualEntryDoc } from "@/services/firestore/manualEntries";
import { estimateProgress } from "@/services/groq/progress";
import { safely, withTimeout } from "@/services/safely";

/** What the user types into the manual entry form. */
export interface ManualInput {
  /** What the email is about. */
  activity: string;
  /** YYYY-MM-DD, or "". */
  eventDate: string;
  progressNote: string;
  remarks: string;
}

export async function loadManual(uid: string) {
  const list = await safely("load manual entries", () => store.listManualEntries(uid));
  if (list) actions.setManual(list);
}

/** The AI decides the progress meter. If it can't, the entry is still saved and can be re-rated by editing. */
export async function rate(input: ManualInput) {
  try {
    return { ...(await estimateProgress(input)), rated: true };
  } catch {
    return { stage: "Not rated", percent: 0, rated: false };
  }
}

export async function addManualEntry(uid: string, input: ManualInput): Promise<{ rated: boolean }> {
  const rating = await rate(input);
  const doc: ManualEntryDoc = {
    ...input,
    stage: rating.stage,
    percent: rating.percent,
    priority: "Medium",
    archived: false,
    completedAt: 0,
    createdMs: Date.now(),
  };
  const id = await withTimeout(store.createManualEntry(uid, doc), 10_000);
  actions.setManual([{ id, ...doc }, ...getManual()]);
  return { rated: rating.rated };
}

export async function editManualEntry(
  uid: string,
  id: string,
  input: ManualInput,
): Promise<{ rated: boolean }> {
  const existing = getManual().find((e) => e.id === id);
  if (!existing) throw new Error("That entry no longer exists.");

  // Only ask the AI again if something that affects progress changed.
  const changed =
    input.activity !== existing.activity ||
    input.eventDate !== existing.eventDate ||
    input.progressNote !== existing.progressNote;
  const rating = changed
    ? await rate(input)
    : { stage: existing.stage, percent: existing.percent, rated: true };
  // A failed rating must not wipe a good one that is already there.
  const keep = changed && !rating.rated;
  const patch: Partial<ManualEntryDoc> = {
    ...input,
    stage: keep ? existing.stage : rating.stage,
    percent: keep ? existing.percent : rating.percent,
  };

  await withTimeout(store.updateManualEntry(uid, id, patch), 10_000);
  actions.setManual(getManual().map((e): ManualEntry => (e.id === id ? { ...e, ...patch } : e)));
  return { rated: rating.rated };
}

export async function deleteManualEntry(uid: string, id: string) {
  actions.setManual(getManual().filter((e) => e.id !== id));
  await safely("delete manual entry", () => store.deleteManualEntry(uid, id));
  // Its stored AI summary and follow-up draft belong to it alone, so they go too.
  await safely("delete stored AI responses", () => store.deleteAiResponse(uid, `manual:${id}`));
}

/**
 * Saves edits made directly on a manual card (priority, remarks, complete). The
 * card updates at once; the write is held back briefly so typing in the remarks
 * box doesn't save on every keystroke.
 */
export function createEditSink(uid: string) {
  const pending = new Map<string, { patch: ManualEdit; timer: ReturnType<typeof setTimeout> }>();
  return (id: string, patch: ManualEdit) => {
    actions.setManual(getManual().map((e): ManualEntry => (e.id === id ? { ...e, ...patch } : e)));
    const current = pending.get(id);
    clearTimeout(current?.timer);
    const merged = { ...current?.patch, ...patch };
    pending.set(id, {
      patch: merged,
      timer: setTimeout(() => {
        pending.delete(id);
        void safely("save manual edit", () => store.updateManualEntry(uid, id, merged));
      }, 600),
    });
  };
}
