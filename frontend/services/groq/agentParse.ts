// Pure validation of the agent's replies, with no app imports so it can be tested alone.

export type Priority = "High" | "Medium" | "Low";
export type Field = "subject" | "body" | "both";
/** Email refs ("m3") or the whole candidate pool. */
export type Target = string[] | "pool";

export type Action =
  | { tool: "senders"; contains: string }
  | { tool: "pick_senders"; names: string[] }
  | { tool: "keyword"; terms: string[]; in: Field; scope: "all" | "pool" }
  | { tool: "search_inbox"; terms: string[]; from: string[]; pages: number }
  | { tool: "list"; offset: number }
  | { tool: "read"; refs: string[] }
  | { tool: "drop"; refs: string[] }
  | { tool: "mark"; refs: Target; priority: Priority }
  | { tool: "show"; refs: Target }
  | { tool: "remember"; rule: string }
  | { tool: "finish"; reply: string; group: string | null };

export interface Turn {
  /** The model's own memory for the next turn (earlier turns are not resent). */
  notes: string;
  actions: Action[];
}

export const MAX_ACTIONS = 4;
const PRIORITIES: Priority[] = ["High", "Medium", "Low"];

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, max: number, len = 60) =>
  Array.isArray(v) ? v.map((x) => text(x, len)).filter(Boolean).slice(0, max) : [];
const refs = (v: unknown, max: number) =>
  list(v, max, 12).filter((r) => /^m\d+$/.test(r));
const target = (v: unknown): Target | null => {
  if (v === "pool") return "pool";
  const r = refs(v, 300);
  return r.length ? r : null;
};

function action(raw: unknown): Action | null {
  if (!raw || typeof raw !== "object") return null;
  // The model writes arguments either flat ({"tool":"x","terms":[]}) or nested under "args".
  const r = raw as Record<string, unknown>;
  const nested = r.args && typeof r.args === "object" ? (r.args as Record<string, unknown>) : {};
  const a: Record<string, unknown> = { ...nested, ...r };
  switch (a.tool) {
    case "senders":
      return { tool: "senders", contains: text(a.contains, 60) };
    case "pick_senders": {
      const names = list(a.names, 10);
      return names.length ? { tool: "pick_senders", names } : null;
    }
    case "keyword": {
      const terms = list(a.terms, 8, 40);
      if (!terms.length) return null;
      const field = (["subject", "body", "both"] as const).find((f) => f === a.in) ?? "both";
      return { tool: "keyword", terms, in: field, scope: a.scope === "pool" ? "pool" : "all" };
    }
    case "search_inbox": {
      const terms = list(a.terms, 8, 40);
      const from = list(a.from, 5);
      if (!terms.length && !from.length) return null;
      const pages = Math.min(Math.max(Math.round(Number(a.pages) || 1), 1), 40);
      return { tool: "search_inbox", terms, from, pages };
    }
    case "list":
      return { tool: "list", offset: Math.max(0, Math.round(Number(a.offset) || 0)) };
    case "read": {
      const r = refs(a.refs, 8);
      return r.length ? { tool: "read", refs: r } : null;
    }
    case "drop": {
      const r = refs(a.refs, 300);
      return r.length ? { tool: "drop", refs: r } : null;
    }
    case "mark": {
      const t = target(a.refs);
      const priority = PRIORITIES.find((p) => p === a.priority);
      return t && priority ? { tool: "mark", refs: t, priority } : null;
    }
    case "show": {
      const t = target(a.refs);
      return t ? { tool: "show", refs: t } : null;
    }
    case "remember": {
      const rule = text(a.rule, 160);
      return rule ? { tool: "remember", rule } : null;
    }
    case "finish":
      return {
        tool: "finish",
        reply: text(a.reply, 300) || "Done.",
        group: text(a.group, 40) || null,
      };
    default:
      return null;
  }
}

/** Turns the model's JSON into trusted actions. Returns null if the reply isn't usable at all. */
export function parseTurn(reply: string): Turn | null {
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(reply.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    data = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const raw = Array.isArray(data.actions) ? data.actions : data.tool ? [data] : [];
  const valid = raw.map(action).filter((a): a is Action => a !== null);
  // Keep at most MAX_ACTIONS, but never lose a closing `finish` to the cap.
  const finish = valid.find((a) => a.tool === "finish");
  const actions: Action[] = valid
    .filter((a) => a.tool !== "finish")
    .slice(0, finish ? MAX_ACTIONS - 1 : MAX_ACTIONS);
  if (finish) actions.push(finish);
  if (!actions.length) return null;
  return { notes: text(data.notes, 200), actions };
}
