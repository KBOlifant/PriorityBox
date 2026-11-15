import * as crud from "./crud";
import { USERS } from "./users";

/**
 * The user's custom memory for the AI: users/{uid}/settings/memory.
 * Short notes the user wrote themselves ("My manager is Sarah Lee"), sent with
 * every AI request. Only the user writes these; the AI can't change them.
 */
type MemoryDoc = { items: string[] };

const path = (uid: string) => `${USERS}/${uid}/settings`;
const ID = "memory";

export async function getMemory(uid: string): Promise<string[] | null> {
  const doc = await crud.get<MemoryDoc>(path(uid), ID);
  return doc && Array.isArray(doc.items) ? doc.items.filter((i) => typeof i === "string") : null;
}

export const saveMemory = (uid: string, items: string[]) =>
  crud.upsert<MemoryDoc>(path(uid), ID, { items });
