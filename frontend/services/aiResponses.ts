import { cache } from "./cache";
import * as store from "./firestore";
import { draftReply, summarizeEmail } from "./groq";
import type { Message } from "@/lib/types";

/**
 * Composes Groq (generation), Firestore (storage) and the cache so each
 * response is generated once and then reused:
 *
 *   read:  cache -> Firestore -> Groq
 *   write: Groq/user edit -> cache + Firestore
 *
 * Storage problems never block the AI result: a failed read falls through to
 * the next layer, a failed write is logged and skipped.
 */

const key = (uid: string, messageId: string, kind: "summary" | "followUp") =>
  `ai:${uid}:${messageId}:${kind}`;

/** Firestore retries forever when it can't reach the database, so cap how long we wait. */
const STORAGE_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function safely<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await withTimeout(fn(), STORAGE_TIMEOUT_MS);
  } catch (err) {
    console.warn(`[aiResponses] ${label} failed`, err);
    return null;
  }
}

/** Returns the saved summary, generating and saving one when missing or `refresh` is set. */
export async function loadSummary(
  uid: string,
  m: Message,
  { refresh = false }: { refresh?: boolean } = {},
): Promise<string> {
  const k = key(uid, m.id, "summary");

  if (!refresh) {
    const cached = await cache.get<string>(k);
    if (cached) return cached;

    const saved = await safely("read summary", () => store.getAiResponse(uid, m.id));
    if (saved?.summary) {
      await cache.set(k, saved.summary);
      return saved.summary;
    }
  }

  const summary = await summarizeEmail(m);
  await cache.set(k, summary);
  await safely("save summary", () => store.saveSummary(uid, m.id, summary));
  return summary;
}

/** Returns the saved follow-up draft, or null if none has been written yet. */
export async function loadFollowUp(uid: string, messageId: string) {
  const k = key(uid, messageId, "followUp");

  const cached = await cache.get<string>(k);
  if (cached) return cached;

  const saved = await safely("read follow-up", () => store.getAiResponse(uid, messageId));
  if (saved?.followUp) {
    await cache.set(k, saved.followUp);
    return saved.followUp;
  }
  return null;
}

/** Generates a new follow-up draft and saves it, replacing any previous one. */
export async function createFollowUp(
  uid: string,
  m: Message,
  userName: string,
): Promise<string> {
  const draft = await draftReply(m, userName);
  await cache.set(key(uid, m.id, "followUp"), draft);
  await safely("save follow-up", () => store.saveFollowUp(uid, m.id, draft));
  return draft;
}

/** Saves the user's edits to a follow-up draft. Returns whether Firestore accepted it. */
export async function updateFollowUp(uid: string, messageId: string, text: string) {
  await cache.set(key(uid, messageId, "followUp"), text);
  const ok = await safely("update follow-up", async () => {
    await store.saveFollowUp(uid, messageId, text);
    return true;
  });
  return ok === true;
}

export async function discardFollowUp(uid: string, messageId: string) {
  await cache.del(key(uid, messageId, "followUp"));
  await safely("discard follow-up", () => store.clearFollowUp(uid, messageId));
}
