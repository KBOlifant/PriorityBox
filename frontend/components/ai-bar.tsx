"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Check, ListChecks, Loader2, Sparkles, X } from "lucide-react";
import { SaveToFolder } from "./save-to-folder";
import { analyseFound } from "@/lib/mail";
import { AI_OFFLINE_HINT, useOnline } from "@/lib/online";
import { actions, getMessages, useStore } from "@/lib/store";
import type { Priority } from "@/lib/types";
import { runAgent, type AgentResult } from "@/services/groq/agent";

/**
 * Guard rail: the AI never changes anything by itself. Priority changes and new
 * urgency rules wait here for the user's OK, so an email that tricks the model
 * can at most propose a change, never make one.
 */
interface Outcome extends AgentResult {
  instruction: string;
  /** Priority changes waiting for the user's OK. */
  pending: Record<string, Priority> | null;
  /** A standing urgency rule waiting for the user's OK. */
  pendingRule: string | null;
  /** What applied changes replaced, for Undo; null when nothing is applied (or it was undone). */
  undo: Record<string, Priority> | null;
  applied: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Free-text instructions to the AI: find emails, re-mark priority, group them into folders. */
export function AiBar({ className = "" }: { className?: string }) {
  const { messages, rules, mode, usingSample } = useStore();
  const online = useOnline();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  /** Finished steps of the current run, in plain words. */
  const [steps, setSteps] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [showRules, setShowRules] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const open = Boolean(error || outcome || showRules || busy);

  function dismiss() {
    setError("");
    setOutcome(null);
    setShowRules(false);
  }

  // The panel sits in the page above the results, so clicking the results (ticking
  // emails) must not close it: only the close button or Escape (with focus in the bar) do.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("[role=dialog]")) return;
      if (!root.current?.contains(document.activeElement)) return;
      setError("");
      setOutcome(null);
      setShowRules(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  /** Applies priority changes and remembers what they replaced, so they can be undone. */
  function apply(changes: Record<string, Priority>): Record<string, Priority> {
    const before = new Map(getMessages().map((m) => [m.id, m.priority]));
    const undo: Record<string, Priority> = {};
    for (const id of Object.keys(changes)) {
      const p = before.get(id);
      if (p) undo[id] = p;
    }
    actions.setPriorities(changes);
    return undo;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const instruction = text.trim();
    if (!instruction || busy || !online) return;
    if (!messages.length) {
      setError("There are no messages to work with yet.");
      return;
    }

    setBusy(true);
    setProgress("Thinking…");
    setSteps([]);
    setStartedAt(Date.now());
    dismiss();
    try {
      const result = await runAgent(instruction, {
        getMessages,
        rules,
        // Sample data and manual entries have no mailbox behind them to search.
        canSearch: mode === "mail" && !usingSample,
        hooks: {
          onProgress: setProgress,
          onStep: (summary) => summary && setSteps((s) => [...s, summary]),
          askScope: (req) => {
            setProgress("Waiting for you to choose how far back to search…");
            return actions.askScope(req.total, req.count);
          },
        },
      });

      // Showing results is harmless; changes to priorities and rules wait for the user.
      if (result.show) actions.setAiFilter({ ids: result.show, query: instruction });
      // Older emails the search added get their AI analysis now that the search is done.
      if (result.foundOlder) analyseFound();

      setOutcome({
        ...result,
        instruction,
        pending: Object.keys(result.marks).length ? result.marks : null,
        pendingRule: result.rule && !rules.includes(result.rule) ? result.rule : null,
        rule: null, // set once the user accepts it
        undo: null,
        applied: 0,
      });
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <div ref={root} className={`relative w-full min-w-0 ${className}`}>
      <form onSubmit={submit} className="relative">
        <label className="sr-only" htmlFor="ai-bar">
          Ask AI to find, group or re-mark emails
        </label>
        <Sparkles
          className={`pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-accent-text ${busy ? "animate-pulse" : ""}`}
        />
        <input
          id="ai-bar"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy || !online}
          title={online ? undefined : AI_OFFLINE_HINT}
          placeholder={
            online ? "Ask AI: group invoices, or mark deadlines urgent" : "AI is unavailable offline"
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
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUp className="size-3.5" />}
          </button>
        </div>
        {/* A light sweeping along the bottom edge while the AI works. */}
        {busy && (
          <span className="pointer-events-none absolute inset-x-3 bottom-0 h-0.5 overflow-hidden rounded-full" aria-hidden>
            <motion.span
              className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-accent-text to-transparent"
              initial={{ left: "-33%" }}
              animate={{ left: "100%" }}
              transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
            />
          </span>
        )}
      </form>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            role={error ? "alert" : "status"}
            className="relative mt-2 rounded-xl border border-line bg-surface p-4 text-[13px] shadow-sm shadow-black/10"
          >
            {!busy && (
              <button
                type="button"
                onClick={dismiss}
                aria-label="Close"
                className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-md text-muted hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            )}

            {busy && <WorkingPanel steps={steps} current={progress} startedAt={startedAt} />}

            {error && <p className="pr-6 text-danger">{error}</p>}

            {outcome && !busy && (
              <OutcomePanel steps={steps} outcome={outcome} onChange={setOutcome} apply={apply} />
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

/** Live view of a run: each finished step with what it found, the current step, and time spent. */
function WorkingPanel({ steps, current, startedAt }: { steps: string[]; current: string; startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));

  return (
    <div aria-live="polite">
      <p className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        <span className="flex items-center gap-1.5 text-accent-text">
          <Sparkles className="size-3.5 animate-pulse" />
          AI is working
        </span>
        <span className="tabular-nums tracking-normal">{seconds}s</span>
      </p>
      <ol className="mt-3 space-y-1.5 text-[12.5px]">
        {steps.map((s, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-2 text-muted"
          >
            <Check className="mt-0.5 size-3.5 shrink-0 text-accent-text" />
            <span>{s}</span>
          </motion.li>
        ))}
        <li className="flex items-start gap-2 text-ink">
          <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-accent-text" />
          <span>{current}</span>
        </li>
      </ol>
    </div>
  );
}

function OutcomePanel({
  steps,
  outcome: o,
  onChange,
  apply,
}: {
  steps: string[];
  outcome: Outcome;
  onChange: (o: Outcome) => void;
  apply: (changes: Record<string, Priority>) => Record<string, Priority>;
}) {
  const pendingIds = o.pending ? Object.keys(o.pending) : [];
  const pendingCount = pendingIds.length;
  const pendingPriority = o.pending ? Object.values(o.pending)[0] : null;
  const samePriority = o.pending ? Object.values(o.pending).every((p) => p === pendingPriority) : false;
  // Name a few of the affected emails so the user knows what they're approving.
  const byId = new Map(getMessages().map((m) => [m.id, m]));
  const examples = pendingIds
    .map((id) => byId.get(id)?.subject)
    .filter((s): s is string => !!s)
    .slice(0, 3);

  return (
    <div className="pr-6">
      <p className="leading-6 text-ink">{o.reply}</p>
      <ul className="mt-2 space-y-1 text-[12px] text-muted">
        {o.show && <li>Showing {plural(o.show.length, "matching email")}</li>}
        {o.foundOlder > 0 && <li>Found {plural(o.foundOlder, "older email")}, now listed in your inbox</li>}
        {o.corrections.map((c) => (
          <li key={c.typed}>
            Matched “{c.typed}” as {c.used.map((u) => `“${u}”`).join(", ")}
          </li>
        ))}
        {o.applied > 0 && (
          <li className="flex items-center gap-2">
            Re-marked {plural(o.applied, "email")}
            {o.undo && (
              <button
                type="button"
                onClick={() => {
                  actions.setPriorities(o.undo!);
                  onChange({ ...o, undo: null, applied: 0 });
                }}
                className="font-medium text-accent-text hover:underline"
              >
                Undo
              </button>
            )}
          </li>
        )}
        {o.rule && <li>Remembered: “{o.rule}”</li>}
      </ul>

      {steps.length > 0 && (
        <details className="mt-2 text-[12px] text-muted">
          <summary className="cursor-pointer select-none hover:text-ink">
            How I got this ({steps.length} {steps.length === 1 ? "step" : "steps"} · ~{o.tokens.toLocaleString()} tokens)
          </summary>
          <ol className="mt-1.5 space-y-1 pl-1">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="mt-0.5 size-3 shrink-0 text-accent-text" />
                {s}
              </li>
            ))}
          </ol>
        </details>
      )}

      {o.pendingRule && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas/50 px-3 py-2 text-[12.5px]">
          <span className="min-w-0 flex-1 text-body">
            Remember this for future emails? <span className="text-ink">“{o.pendingRule}”</span>
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...o, pendingRule: null })}
            className="font-medium text-muted hover:text-ink"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => {
              actions.addRule(o.pendingRule!);
              onChange({ ...o, rule: o.pendingRule, pendingRule: null });
            }}
            className="rounded-md bg-accent px-2.5 py-1 font-semibold text-white hover:bg-accent-hover"
          >
            Remember
          </button>
        </div>
      )}

      {o.pending && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas/50 px-3 py-2 text-[12.5px]">
          <span className="min-w-0 flex-1 text-body">
            {samePriority
              ? `Mark ${plural(pendingCount, "email")} ${pendingPriority} priority?`
              : `Change the priority of ${plural(pendingCount, "email")}?`}
            {examples.length > 0 && (
              <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                {examples.map((s) => `“${s}”`).join(", ")}
                {pendingCount > examples.length ? ` and ${pendingCount - examples.length} more` : ""}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...o, pending: null })}
            className="font-medium text-muted hover:text-ink"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => {
              const undo = apply(o.pending!);
              onChange({ ...o, pending: null, undo, applied: pendingCount });
            }}
            className="rounded-md bg-accent px-2.5 py-1 font-semibold text-white hover:bg-accent-hover"
          >
            Apply
          </button>
        </div>
      )}

      {o.show && o.show.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <SaveToFolder
            messages={getMessages().filter((m) => o.show!.includes(m.id))}
            defaultName={o.group ?? o.instruction.slice(0, 40)}
            instruction={o.instruction}
          />
        </div>
      )}
    </div>
  );
}
