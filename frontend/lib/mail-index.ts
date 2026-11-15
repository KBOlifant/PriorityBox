// Local, typo-tolerant keyword search over messages. No app imports beyond the
// pure fuzzy helpers, so it can be tested alone.
import { expandWord, normalize, tokenize } from "./fuzzy";

export interface Indexable {
  id: string;
  subject: string;
  body?: string;
  preview: string;
}

export interface MailIndex {
  /** word -> ids of messages with that word in the subject */
  subject: Map<string, Set<string>>;
  /** word -> ids of messages with that word in the body */
  body: Map<string, Set<string>>;
  byId: Map<string, Indexable>;
}

const cache = new WeakMap<readonly Indexable[], MailIndex>();

function add(map: Map<string, Set<string>>, words: string[], id: string) {
  for (const w of words) {
    let ids = map.get(w);
    if (!ids) map.set(w, (ids = new Set()));
    ids.add(id);
  }
}

/** Word index of subjects and bodies. Built once per message list. */
export function buildIndex(messages: readonly Indexable[]): MailIndex {
  const hit = cache.get(messages);
  if (hit) return hit;
  const index: MailIndex = { subject: new Map(), body: new Map(), byId: new Map() };
  for (const m of messages) {
    index.byId.set(m.id, m);
    add(index.subject, tokenize(m.subject), m.id);
    add(index.body, tokenize(m.body ?? m.preview), m.id);
  }
  cache.set(messages, index);
  return index;
}

export type Field = "subject" | "body" | "both";

export interface TermResult {
  /** What was searched for, as given. */
  term: string;
  /** The words actually matched in this mail (spelling corrections and longer forms). */
  variants: string[];
  ids: Set<string>;
}

function vocab(index: MailIndex, field: Field): Set<string> {
  if (field === "subject") return new Set(index.subject.keys());
  if (field === "body") return new Set(index.body.keys());
  return new Set([...index.subject.keys(), ...index.body.keys()]);
}

function idsFor(index: MailIndex, field: Field, word: string): Set<string> {
  const out = new Set<string>();
  if (field !== "body") index.subject.get(word)?.forEach((id) => out.add(id));
  if (field !== "subject") index.body.get(word)?.forEach((id) => out.add(id));
  return out;
}

/**
 * Finds messages containing each term, tolerating typos. A term of several words
 * ("late fee") matches messages that contain every word (each typo-tolerant).
 */
export function searchTerms(index: MailIndex, terms: string[], field: Field): TermResult[] {
  const words = vocab(index, field);
  return terms.map((term) => {
    const parts = tokenize(term);
    if (!parts.length) return { term, variants: [], ids: new Set<string>() };
    let ids: Set<string> | undefined;
    const variants: string[] = [];
    for (const part of parts) {
      const forms = expandWord(part, words);
      variants.push(...forms);
      const found = new Set<string>();
      for (const f of forms) idsFor(index, field, f).forEach((id) => found.add(id));
      const prev: Set<string> | undefined = ids;
      ids = prev ? new Set([...prev].filter((id) => found.has(id))) : found;
    }
    return { term, variants: [...new Set(variants)], ids: ids ?? new Set<string>() };
  });
}

/** ~`width` characters around the first place any of `variants` appears, or "" if none does. */
export function excerpt(text: string, variants: string[], width = 80): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const hay = normalize(flat);
  let at = -1;
  for (const v of variants) {
    const re = new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
    const i = hay.search(re);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return "";
  const start = Math.max(0, at - Math.floor(width / 3));
  const piece = flat.slice(start, start + width).trim();
  return `${start > 0 ? "…" : ""}${piece}${start + width < flat.length ? "…" : ""}`;
}
