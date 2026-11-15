// Pure query builders with no app imports, so they can be tested alone.
import type { MailQuery } from "./types";

/** Strips characters that have a meaning in Gmail / KQL search syntax. */
const clean = (s: string) =>
  s
    .replace(/["(){}:\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);

const words = (s: string) => clean(s).split(" ").filter(Boolean);
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (ms: number, sep: string) => {
  const d = new Date(ms);
  return [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join(sep);
};

/** Gmail's `q` syntax: {a b} is OR, a space is AND. The INBOX label is passed separately. */
export function gmailQuery(q: MailQuery): string {
  const parts: string[] = [];
  const phrase = (s: string) => (s.includes(" ") ? `"${s}"` : s);
  const terms = (q.terms ?? []).map(clean).filter(Boolean);
  if (terms.length) parts.push(`{${terms.map(phrase).join(" ")}}`);
  const from = (q.from ?? []).map(clean).filter(Boolean);
  if (from.length) parts.push(`{${from.map((f) => `from:${phrase(f)}`).join(" ")}}`);
  if (q.after) parts.push(`after:${ymd(q.after, "/")}`);
  return parts.join(" ");
}

/**
 * Outlook's KQL for Graph `$search`. The whole value is wrapped in double quotes,
 * so a phrase can't be quoted inside it: its words are joined with AND instead.
 */
export function outlookSearch(q: MailQuery): string {
  const group = (items: string[]) => (items.length > 1 ? `(${items.join(" OR ")})` : items[0]);
  const all = (ws: string[]) => (ws.length > 1 ? `(${ws.join(" AND ")})` : ws[0]);
  const parts: string[] = [];
  const terms = (q.terms ?? []).map(words).filter((w) => w.length).map(all);
  if (terms.length) parts.push(group(terms));
  const from = (q.from ?? [])
    .map(words)
    .filter((w) => w.length)
    .map((ws) => all(ws.map((w) => `from:${w}`)));
  if (from.length) parts.push(group(from));
  if (q.after) parts.push(`received>=${ymd(q.after, "-")}`);
  return parts.join(" AND ");
}

/** A stable key for caching a search's results. */
export const queryKey = (account: string, q: MailQuery) =>
  JSON.stringify([account, [...(q.terms ?? [])].sort(), [...(q.from ?? [])].sort(), q.after ?? 0]);
