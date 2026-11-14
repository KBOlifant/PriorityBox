import { documentId, where } from "firebase/firestore";
import { cache, cacheKey } from "../cache";
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
/** A classification is written once and never changes, so it can sit in the cache for a day. */
const CACHE_TTL_SECONDS = 24 * 3600;

const cacheId = (uid: string, messageId: string) => cacheKey(uid, "cls", messageId);

/**
 * Looks in the cache first and only asks Firestore for the messages it hasn't
 * seen, then remembers what Firestore returned. A page of 25 that was loaded
 * before costs no Firestore reads at all.
 */
export async function getClassifications(
  uid: string,
  messageIds: string[],
): Promise<Record<string, Classification>> {
  const out: Record<string, Classification> = {};

  const hits = await cache.getMany<Classification>(messageIds.map((id) => cacheId(uid, id)));
  const missing: string[] = [];
  messageIds.forEach((id, i) => {
    const hit = hits[i];
    if (hit) out[id] = hit;
    else missing.push(id);
  });
  if (!missing.length) return out;

  const byDocId = new Map(missing.map((id) => [docId(id), id]));
  const ids = [...byDocId.keys()];

  for (let i = 0; i < ids.length; i += IN_LIMIT) {
    const batch = ids.slice(i, i + IN_LIMIT);
    const docs = await crud.list<ClassificationDoc>(
      path(uid),
      where(documentId(), "in", batch),
    );
    for (const d of docs) {
      const messageId = byDocId.get(d.id);
      if (!messageId) continue;
      const c: Classification = {
        priority: d.priority,
        waiting: d.waiting,
        stage: d.stage,
        percent: d.percent,
        tags: d.tags ?? [],
        ...(d.event ? { event: d.event } : {}),
      };
      out[messageId] = c;
      void cache.set(cacheId(uid, messageId), c, CACHE_TTL_SECONDS);
    }
  }
  return out;
}

export async function saveClassification(
  uid: string,
  messageId: string,
  c: Classification,
) {
  await crud.upsert<ClassificationDoc>(path(uid), docId(messageId), {
    priority: c.priority,
    waiting: c.waiting,
    stage: c.stage,
    percent: c.percent,
    tags: c.tags,
    event: c.event ?? null,
  });
  await cache.set(cacheId(uid, messageId), c, CACHE_TTL_SECONDS);
}
