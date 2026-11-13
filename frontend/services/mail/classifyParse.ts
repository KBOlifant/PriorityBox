// Pure validation of model output, with no app imports so it can be tested alone.
import type { Classification } from "./types";

const PRIORITIES = ["High", "Medium", "Low"] as const;

const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

function validDate(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}

/** Turns the model's JSON reply into trusted classifications, dropping anything malformed. */
export function parseClassifications(
  reply: string,
  validIds: Set<string>,
): Record<string, Classification> {
  let data: unknown;
  try {
    // Some models wrap JSON in a code fence despite instructions.
    data = JSON.parse(reply.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return {};
  }
  const results = (data as { results?: unknown })?.results;
  if (!Array.isArray(results)) return {};

  const out: Record<string, Classification> = {};
  for (const item of results) {
    const r = item as Record<string, unknown>;
    const id = typeof r?.id === "string" ? r.id : "";
    if (!validIds.has(id)) continue;

    const priority = PRIORITIES.find((p) => p === r.priority) ?? "Medium";
    const date = validDate((r.event as { date?: unknown } | null)?.date);
    const label = text((r.event as { label?: unknown } | null)?.label, 40);
    const percent = Math.round(Number(r.percent));

    out[id] = {
      priority,
      waiting: r.waiting === true,
      stage: text(r.stage, 40) || "Not started",
      percent: Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0,
      tags: Array.isArray(r.tags)
        ? r.tags.map((t) => text(t, 20)).filter(Boolean).slice(0, 2)
        : [],
      ...(date && label ? { event: { label, date } } : {}),
    };
  }
  return out;
}

/** "2025-09-18" -> "Sep 18, 2025" (no timezone shifting). */
export function formatEventDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
