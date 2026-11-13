"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, ListChecks, Loader2, Sparkles, X } from "lucide-react";
import { AI_OFFLINE_HINT, useOnline } from "@/lib/online";
import { actions, useStore } from "@/lib/store";
import type { Priority } from "@/lib/types";
import { evaluateInbox } from "@/services/groq/evaluate";

interface Outcome {
  reply: string;
  remarked: number;
  matches: number | null;
  rule: string | null;
  /** Loaded messages that were too old to include in the request. */
  skipped: number;
  considered: number;
}

/** Free-text instructions to the AI: find emails, or re-mark what counts as urgent. */
export function AiBar() {
  const { messages, rules } = useStore();
  const online = useOnline();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [showRules, setShowRules] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const open = Boolean(error || outcome || showRules);

  function dismiss() {
    setError("");
    setOutcome(null);
    setShowRules(false);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setError("");
      setOutcome(null);
      setShowRules(false);
    };
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const instruction = text.trim();
    if (!instruction || busy || !online) return;
    if (!messages.length) {
      setError("There are no messages to work with yet.");
      return;
    }

    setBusy(true);
    dismiss();
    try {
      const result = await evaluateInbox(instruction, messages, rules);

      const current = new Map(messages.map((m) => [m.id, m.priority]));
      const changes: Record<string, Priority> = {};
      for (const p of result.priorities) {
        if (current.get(p.id) !== p.priority) changes[p.id] = p.priority;
      }
      const remarked = Object.keys(changes).length;
      if (remarked) actions.setPriorities(changes);
      if (result.show) actions.setAiFilter({ ids: result.show, query: instruction });
      if (result.rule) actions.addRule(result.rule);

      setOutcome({
        reply: result.reply,
        remarked,
        matches: result.show ? result.show.length : null,
        rule: result.rule,
        // Only the newest messages fit in one request; say so when some were left out.
        skipped: Math.max(0, messages.length - result.considered),
        considered: result.considered,
      });
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={root} className="relative min-w-0 flex-1 max-w-[460px]">
      <form onSubmit={submit} className="relative">
        <label className="sr-only" htmlFor="ai-bar">
          Ask AI to find emails or re-mark priority
        </label>
        <Sparkles className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-accent-text" />
        <input
          id="ai-bar"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy || !online}
          title={online ? undefined : AI_OFFLINE_HINT}
          placeholder={
            online ? "Ask AI: find invoices, or mark deadlines urgent" : "AI is unavailable offline"
          }
          className="h-10 w-full rounded-xl border border-accent-line bg-accent-soft/50 pl-11 pr-[4.5rem] text-[13px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent-text/60 focus:ring-2 focus:ring-accent/30 disabled:opacity-70"
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {rules.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const next = !showRules;
                dismiss();
                setShowRules(next);
              }}
              aria-label={`Your urgency rules (${rules.length})`}
              title={`Your urgency rules (${rules.length})`}
              className="relative grid size-7 place-items-center rounded-lg text-muted transition-colors hover:text-ink"
            >
              <ListChecks className="size-4" />
              <span className="absolute -right-0.5 -top-0.5 grid size-3.5 place-items-center rounded-full bg-accent text-[9px] font-semibold text-white">
                {rules.length}
              </span>
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !text.trim()}
            aria-label="Send to AI"
            className="grid size-7 place-items-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-hover disabled:bg-surface-2 disabled:text-muted"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ArrowUp className="size-3.5" />
            )}
          </button>
        </div>
      </form>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            role={error ? "alert" : "status"}
            className="absolute left-0 right-0 top-full z-30 mt-2 rounded-xl border border-line bg-surface p-4 text-[13px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7)]"
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close"
              className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-md text-muted hover:text-ink"
            >
              <X className="size-3.5" />
            </button>

            {error && <p className="pr-6 text-[#f0a090]">{error}</p>}

            {outcome && (
              <div className="pr-6">
                <p className="leading-6 text-ink">{outcome.reply}</p>
                <ul className="mt-2 space-y-1 text-[12px] text-muted">
                  {outcome.matches !== null && (
                    <li>
                      Showing {outcome.matches} matching{" "}
                      {outcome.matches === 1 ? "email" : "emails"}
                    </li>
                  )}
                  {outcome.remarked > 0 && (
                    <li>
                      Re-marked {outcome.remarked}{" "}
                      {outcome.remarked === 1 ? "email" : "emails"}
                    </li>
                  )}
                  {outcome.rule && <li>Remembered: “{outcome.rule}”</li>}
                  {outcome.skipped > 0 && (
                    <li>
                      Looked at the newest {outcome.considered} messages; {outcome.skipped}{" "}
                      older {outcome.skipped === 1 ? "one was" : "ones were"} not included.
                    </li>
                  )}
                </ul>
              </div>
            )}

            {showRules && (
              <div className="pr-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  What you consider urgent
                </p>
                <ul className="mt-2 space-y-1.5">
                  {rules.map((rule) => (
                    <li key={rule} className="flex items-start gap-2 leading-5 text-body">
                      <span className="flex-1">{rule}</span>
                      <button
                        type="button"
                        onClick={() => actions.removeRule(rule)}
                        aria-label={`Remove rule: ${rule}`}
                        className="mt-0.5 shrink-0 text-muted hover:text-ink"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
