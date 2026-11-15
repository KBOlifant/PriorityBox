"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { History, Loader2 } from "lucide-react";
import { useStore, type ScopePrompt } from "@/lib/store";

const DAY = 86_400_000;
const RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last year", days: 365 },
] as const;

/** Never more than this many older emails are loaded in one search (matches the agent). */
const MAX_LOADED = 300;
/** Rough AI cost per email the agent looks at (a compact row, sometimes an excerpt). */
const TOKENS_PER_EMAIL = 45;
/** The fixed part of a search: instructions and a few turns. */
const BASE_TOKENS = 2500;
const TOKENS_PER_MINUTE = 8000;

const estimate = (emails: number) => BASE_TOKENS + Math.min(emails, MAX_LOADED) * TOKENS_PER_EMAIL;
const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));

/** Asks how far back the AI may search when a search would cover more than a few pages. */
export function SearchScopeModal() {
  const { scopePrompt } = useStore();
  return (
    <AnimatePresence>
      {scopePrompt && <ScopeDialog key="scope" prompt={scopePrompt} />}
    </AnimatePresence>
  );
}

function ScopeDialog({ prompt }: { prompt: ScopePrompt }) {
  // The cutoffs are fixed when the dialog opens, so the counts match what is searched.
  const [now] = useState(() => Date.now());
  const [counts, setCounts] = useState<(number | null)[]>(RANGES.map(() => null));
  // -1 = the whole inbox.
  const [choice, setChoice] = useState(1);

  useEffect(() => {
    let live = true;
    RANGES.forEach((r, i) => {
      prompt
        .count(now - r.days * DAY)
        .catch(() => null)
        .then((n) => {
          if (live) setCounts((c) => c.map((v, j) => (j === i ? n : v)));
        });
    });
    return () => {
      live = false;
    };
  }, [prompt, now]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") prompt.resolve(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [prompt]);

  const options = [
    ...RANGES.map((r, i) => ({ key: i, label: r.label, count: counts[i] })),
    { key: -1, label: "Whole inbox", count: prompt.total as number | null },
  ];
  const picked = options.find((o) => o.key === choice)!;
  const pickedTokens = picked.count === null ? null : estimate(picked.count);

  function confirm() {
    prompt.resolve(choice === -1 ? undefined : now - RANGES[choice].days * DAY);
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => prompt.resolve(null)}
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scope-title"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] rounded-2xl border border-line bg-raised p-6 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-accent-line bg-accent-soft text-accent-text">
            <History className="size-4" />
          </span>
          <div>
            <h2 id="scope-title" className="text-[16px] font-semibold">
              Search further back?
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-body">
              This could match about {fmt(prompt.total)} emails in your inbox. Choose how far back the AI should look.
            </p>
          </div>
        </div>

        <fieldset className="mt-5 space-y-1.5">
          <legend className="sr-only">How far back to search</legend>
          {options.map((o) => (
            <label
              key={o.key}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-[13px] transition-colors ${
                choice === o.key ? "border-accent-line bg-accent-soft/60" : "border-line hover:border-line-strong"
              }`}
            >
              <input
                type="radio"
                name="scope"
                checked={choice === o.key}
                onChange={() => setChoice(o.key)}
                className="accent-accent"
              />
              <span className="flex-1 font-medium text-ink">{o.label}</span>
              <span className="tabular-nums text-muted">
                {o.count === null ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <>
                    ~{fmt(o.count)} emails · ~{fmt(estimate(o.count))} tokens
                  </>
                )}
              </span>
            </label>
          ))}
        </fieldset>

        <p className="mt-4 rounded-lg bg-canvas/60 px-3 py-2 text-[12px] leading-5 text-muted">
          AI use is limited to about {fmt(TOKENS_PER_MINUTE)} tokens a minute, shared with mail analysis. At most{" "}
          {MAX_LOADED} older emails are loaded per search.
          {pickedTokens !== null && pickedTokens > TOKENS_PER_MINUTE && (
            <span className="text-warn"> This choice may take a few minutes.</span>
          )}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => prompt.resolve(null)}
            className="h-9 rounded-lg border border-line px-4 text-[13px] font-medium text-body transition-colors hover:border-line-strong hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            className="h-9 rounded-lg bg-accent px-4 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Search
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
