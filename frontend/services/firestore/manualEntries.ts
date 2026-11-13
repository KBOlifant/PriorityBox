import * as crud from "./crud";
import type { Stored } from "./crud";
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

const fromDoc = (d: Stored<ManualEntryDoc>): ManualEntry => ({
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
});

const newestFirst = (a: ManualEntry, b: ManualEntry) => b.createdMs - a.createdMs;

export async function listManualEntries(uid: string): Promise<ManualEntry[]> {
  return (await crud.list<ManualEntryDoc>(path(uid))).map(fromDoc).sort(newestFirst);
}

/** The entries kept on this device: instant, and works without a connection. */
export async function listManualEntriesCached(uid: string): Promise<ManualEntry[]> {
  return (await crud.listFromCache<ManualEntryDoc>(path(uid))).map(fromDoc).sort(newestFirst);
}

/** A new id for an entry, so it can be shown before it has reached the server. */
export const newManualId = (uid: string) => crud.newId(path(uid));

export const createManualEntry = (uid: string, id: string, entry: ManualEntryDoc) =>
  crud.create<ManualEntryDoc>(path(uid), entry, id);

/** Updates only the given fields. */
export const updateManualEntry = (uid: string, id: string, patch: Partial<ManualEntryDoc>) =>
  crud.upsert<ManualEntryDoc>(path(uid), id, patch);

export const deleteManualEntry = (uid: string, id: string) => crud.remove(path(uid), id);
