import { documentId, where } from "firebase/firestore";
import * as crud from "./crud";
import { USERS } from "./users";
import type { Classification } from "../mail/types";

/**
 * AI-derived priority, dates and progress for each real message, so a message is
 * analysed once: users/{uid}/classifications/{messageId}. Stores no email text.
 */
type ClassificationDoc = Omit<Classification, "event"> & {
  event?: Classification["event"] | null;
};

const path = (uid: string) => `${USERS}/${uid}/classifications`;

/** Firestore ids can't contain "/". */
const docId = (messageId: string) => messageId.replace(/\//g, "_");

const IN_LIMIT = 30; // Firestore "in" queries accept at most 30 values.

export async function getClassifications(
  uid: string,
  messageIds: string[],
): Promise<Record<string, Classification>> {
  const byDocId = new Map(messageIds.map((id) => [docId(id), id]));
  const ids = [...byDocId.keys()];
  const out: Record<string, Classification> = {};

  for (let i = 0; i < ids.length; i += IN_LIMIT) {
    const batch = ids.slice(i, i + IN_LIMIT);
    const docs = await crud.list<ClassificationDoc>(
      path(uid),
      where(documentId(), "in", batch),
    );
    for (const d of docs) {
      const messageId = byDocId.get(d.id);
      if (!messageId) continue;
      out[messageId] = {
        priority: d.priority,
        waiting: d.waiting,
        stage: d.stage,
        percent: d.percent,
        tags: d.tags ?? [],
        ...(d.event ? { event: d.event } : {}),
      };
    }
  }
  return out;
}

export const saveClassification = (
  uid: string,
  messageId: string,
  c: Classification,
) =>
  crud.upsert<ClassificationDoc>(path(uid), docId(messageId), {
    priority: c.priority,
    waiting: c.waiting,
    stage: c.stage,
    percent: c.percent,
    tags: c.tags,
    event: c.event ?? null,
  });
