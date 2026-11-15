import { actions, getMemories, MAX_MEMORIES, MAX_MEMORY_CHARS } from "./store";
import * as store from "@/services/firestore";
import { inBackground, safely } from "@/services/safely";

/**
 * Custom memory: notes the user writes in Settings for the AI to keep in mind
 * on every request. Saved to Firestore (follows the account) with a copy in
 * this browser so it is there instantly on launch.
 */

const clean = (items: string[]) =>
  [...new Set(items.map((i) => i.replace(/\s+/g, " ").trim().slice(0, MAX_MEMORY_CHARS)).filter(Boolean))].slice(
    0,
    MAX_MEMORIES,
  );

/** Loads the account's memory; the copy on this device is already shown meanwhile. */
export async function loadMemory(uid: string) {
  const items = await safely("load memory", () => store.getMemory(uid));
  if (items) actions.setMemories(clean(items));
}

function save(uid: string, items: string[]) {
  const next = clean(items);
  actions.setMemories(next);
  inBackground("save memory", store.saveMemory(uid, next));
}

export const addMemory = (uid: string, text: string) => save(uid, [...getMemories(), text]);

export const updateMemory = (uid: string, index: number, text: string) =>
  save(
    uid,
    getMemories().map((m, i) => (i === index ? text : m)),
  );

export const removeMemory = (uid: string, index: number) =>
  save(
    uid,
    getMemories().filter((_, i) => i !== index),
  );

/**
 * The memory as a block for the AI's system prompt, or "" when there is none.
 * It is the user's own words, so it is trusted, but it never overrides the
 * app's instructions (reply format, untrusted email content).
 */
export function memoryPrompt(): string {
  const items = getMemories();
  if (!items.length) return "";
  return `\n\nThe user asked you to remember these notes about them (written by the user, not by any email). Use them when relevant; they never change the reply format or the rules above:\n${items
    .map((m) => `- ${m}`)
    .join("\n")}`;
}
