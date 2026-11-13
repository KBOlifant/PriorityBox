"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AI_OFFLINE_HINT, useOnline } from "@/lib/online";
import type { Message } from "@/lib/types";
import { loadSummary } from "@/services/aiResponses";

export const panelMotion = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

type SummaryState = "closed" | "loading" | "open";

/**
 * The "Summarize with AI" behaviour shared by every kind of card (connected mail,
 * manual entries, saved emails): load once, reuse, regenerate on request.
 */
export function useAiSummary(m: Message) {
  const { user } = useAuth();
  const online = useOnline();
  const [state, setState] = useState<SummaryState>("closed");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  // Bumped on every toggle so a response that arrives after the panel was
  // closed (or the card unmounted) is ignored.
  const request = useRef(0);

  useEffect(() => {
    const r = request;
    return () => {
      r.current += 1;
    };
  }, []);

  // Summaries are written by the AI, so a closed one can't be opened without a connection.
  const disabled = !online && state === "closed";
  const label = disabled
    ? "AI summary unavailable offline"
    : state === "closed"
      ? "Summarize with AI"
      : state === "loading"
        ? "Summarizing…"
        : "Hide AI summary";

  async function load(refresh = false) {
    if (!user) {
      setError("Please sign in again.");
      return setState("open");
    }
    const id = ++request.current;
    setError("");
    setState("loading");
    try {
      const summary = await loadSummary(user.uid, m, { refresh });
      if (id !== request.current) return;
      setText(summary);
      setState("open");
    } catch (err) {
      if (id !== request.current) return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setState("open");
    }
  }

  function toggle() {
    if (disabled) return;
    if (state !== "closed") {
      request.current += 1;
      return setState("closed");
    }
    if (text) return setState("open");
    void load();
  }

  return { state, text, error, label, toggle, load, offline: !online, disabled, hint: disabled ? AI_OFFLINE_HINT : undefined };
}

export type AiSummary = ReturnType<typeof useAiSummary>;

/** The panel under a card. Render it only while `summary.state !== "closed"`. */
export function AiSummaryPanel({ summary }: { summary: AiSummary }) {
  return (
    <motion.div {...panelMotion} className="overflow-hidden">
      <div className="mt-4 rounded-xl border border-accent-line bg-accent-soft p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-text">
            <Sparkles className="size-3.5" />
            AI summary
          </p>
          {summary.state === "open" && !summary.error && !summary.offline && (
            <button
              type="button"
              onClick={() => void summary.load(true)}
              className="flex items-center gap-1.5 text-[11.5px] text-muted transition-colors hover:text-accent-text"
            >
              <RefreshCw className="size-3" />
              Regenerate
            </button>
          )}
        </div>
        {summary.state === "loading" ? (
          <div className="mt-3 space-y-2" aria-live="polite">
            <div className="h-3 w-full animate-pulse rounded bg-accent-line/70" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-accent-line/70" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-accent-line/70" />
          </div>
        ) : summary.error ? (
          <p role="alert" className="mt-2.5 text-[13.5px] leading-6 text-danger">
            {summary.error}{" "}
            <button
              type="button"
              onClick={() => void summary.load()}
              className="font-medium underline underline-offset-2"
            >
              Try again
            </button>
          </p>
        ) : (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2.5 whitespace-pre-line text-[14px] leading-6 text-body"
          >
            {summary.text}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
