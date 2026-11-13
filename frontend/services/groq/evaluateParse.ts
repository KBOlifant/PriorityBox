// Pure validation of the model's reply, with no app imports so it can be tested alone.

export type Priority = "High" | "Medium" | "Low";

export interface Evaluation {
  /** One short sentence telling the user what was done. */
  reply: string;
  /** Message ids to show as a search result, or null when the request wasn't a search. */
  show: string[] | null;
  /** Senders the user named (names, addresses or companies). The app matches these itself. */
  from: string[];
  /** Priority changes to apply. */
  priorities: { id: string; priority: Priority }[];
  /** A standing preference about what counts as urgent, to remember. */
  rule: string | null;
}

const PRIORITIES: Priority[] = ["High", "Medium", "Low"];

const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** Turns the model's JSON into a trusted Evaluation. Returns null if it isn't usable. */
export function parseEvaluation(reply: string, validIds: Set<string>): Evaluation | null {
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(reply.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    data = parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  const show = Array.isArray(data.show)
    ? [...new Set(data.show.filter((id): id is string => typeof id === "string" && validIds.has(id)))]
    : null;

  const from = Array.isArray(data.from)
    ? data.from.map((t) => text(t, 60)).filter(Boolean).slice(0, 5)
    : [];

  const seen = new Set<string>();
  const priorities: Evaluation["priorities"] = [];
  if (Array.isArray(data.priorities)) {
    for (const item of data.priorities) {
      const r = item as Record<string, unknown>;
      const id = typeof r?.id === "string" ? r.id : "";
      const priority = PRIORITIES.find((p) => p === r?.priority);
      if (!validIds.has(id) || !priority || seen.has(id)) continue;
      seen.add(id);
      priorities.push({ id, priority });
    }
  }

  return {
    reply: text(data.reply, 300) || "Done.",
    show,
    from,
    priorities,
    rule: text(data.rule, 160) || null,
  };
}
