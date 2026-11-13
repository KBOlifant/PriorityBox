import * as crud from "./crud";
import { USERS } from "./users";
import type { Priority } from "@/lib/types";

/**
 * Entries the user typed in by hand (manual mode), for people who cannot connect
 * a mailbox: users/{uid}/manualEntries/{id}. Everything here was written by the
 * user, so unlike connected mail it is stored in full.
 */
export interface ManualEntryDoc {
  /** What the email is about. */
  activity: string;
  /** YYYY-MM-DD, or "" when there is no event. */
  eventDate: string;
  /** The user's own comment on how it is going. */
  progressNote: string;
  remarks: string;
  /** Decided by the AI from the progress comment. */
  stage: string;
  percent: number;
  priority: Priority;
  archived: boolean;
  /** Epoch ms when marked complete, or 0. */
  completedAt: number;
  /** Epoch ms. */
  createdMs: number;
}

export type ManualEntry = ManualEntryDoc & { id: string };

const path = (uid: string) => `${USERS}/${uid}/manualEntries`;

export async function listManualEntries(uid: string): Promise<ManualEntry[]> {
  const docs = await crud.list<ManualEntryDoc>(path(uid));
  return docs
    .map((d) => ({
      id: d.id,
      activity: d.activity ?? "",
      eventDate: d.eventDate ?? "",
      progressNote: d.progressNote ?? "",
      remarks: d.remarks ?? "",
      stage: d.stage ?? "In progress",
      percent: typeof d.percent === "number" ? d.percent : 0,
      priority: d.priority ?? "Medium",
      archived: !!d.archived,
      completedAt: d.completedAt ?? 0,
      createdMs: d.createdMs ?? 0,
    }))
    .sort((a, b) => b.createdMs - a.createdMs);
}

export const createManualEntry = (uid: string, entry: ManualEntryDoc) =>
  crud.create<ManualEntryDoc>(path(uid), entry);

/** Updates only the given fields. */
export const updateManualEntry = (uid: string, id: string, patch: Partial<ManualEntryDoc>) =>
  crud.upsert<ManualEntryDoc>(path(uid), id, patch);

export const deleteManualEntry = (uid: string, id: string) => crud.remove(path(uid), id);
