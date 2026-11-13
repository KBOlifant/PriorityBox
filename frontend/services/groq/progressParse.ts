// Pure validation of the model's progress rating, with no app imports so it can be tested alone.

export interface ProgressRating {
  /** 0-100, how complete the matter is. */
  percent: number;
  /** A short label such as "In progress". */
  stage: string;
}

/** Turns the model's JSON into a trusted rating. Returns null if it isn't usable. */
export function parseProgress(reply: string): ProgressRating | null {
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(reply.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    data = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const raw = typeof data.percent === "string" ? parseFloat(data.percent) : Number(data.percent);
  if (!Number.isFinite(raw)) return null;
  const stage = typeof data.stage === "string" ? data.stage.trim().slice(0, 40) : "";
  return {
    percent: Math.min(100, Math.max(0, Math.round(raw))),
    stage: stage || "In progress",
  };
}
