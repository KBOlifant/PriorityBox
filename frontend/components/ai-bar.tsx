"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Check, FolderPlus, ListChecks, Loader2, Sparkles, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { addToFolder, createFolder, isFolderable } from "@/lib/folders";
import { analyseFound } from "@/lib/mail";
import { AI_OFFLINE_HINT, useOnline } from "@/lib/online";
import { actions, getMessages, useStore } from "@/lib/store";
import type { Priority } from "@/lib/types";
import { runAgent, type AgentResult } from "@/services/groq/agent";

/** More priority changes than this are confirmed before they are applied. */
const CONFIRM_OVER = 10;

interface Outcome extends AgentResult {
  instruction: string;
  /** Changes waiting for the user's OK (too many to apply silently). */
  pending: Record<string, Priority> | null;
  /** What applied changes replaced, for Undo; null when nothing is applied (or it was undone). */
  undo: Record<string, Priority> | null;
  applied: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Free-text instructions to the AI: find emails, re-mark priority, group them into folders. */
export function AiBar({ className = "" }: { className?: string }) {
  const { messages, rules, mode, folders, usingSample } = useStore();
  const { user } = useAuth();
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

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setError("");
      setOutcome(null);
      setShowRules(false);
    };
    const onDown = (e: MouseEvent) => {
      // Clicks in a dialog (the search-scope question) don't close the result.
      if ((e.target as Element).closest?.("[role=dialog]")) return;
      if (!root.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]")) close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
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

      const count = Object.keys(result.marks).length;
      const confirm = count > CONFIRM_OVER;
      const undo = count && !confirm ? apply(result.marks) : null;
      if (result.show) actions.setAiFilter({ ids: result.show, query: instruction });
      if (result.rule) actions.addRule(result.rule);
      // Older emails the search added get their AI analysis now that the search is done.
      if (result.foundOlder) analyseFound();

      setOutcome({
        ...result,
        instruction,
        pending: confirm ? result.marks : null,
        undo,
        applied: undo ? count : 0,
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
            className="absolute left-0 right-0 top-full z-30 mt-2 rounded-xl border border-line bg-surface p-4 text-[13px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7)]"
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
              <OutcomePanel
                steps={steps}
                outcome={outcome}
                folders={folders}
                uid={user?.uid}
                onChange={setOutcome}
                apply={apply}
              />
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
  folders,
  uid,
  onChange,
  apply,
}: {
  steps: string[];
  outcome: Outcome;
  folders: { id: string; name: string }[];
  uid?: string;
  onChange: (o: Outcome) => void;
  apply: (changes: Record<string, Priority>) => Record<string, Priority>;
}) {
  const pendingCount = o.pending ? Object.keys(o.pending).length : 0;
  const pendingPriority = o.pending ? Object.values(o.pending)[0] : null;
  const samePriority = o.pending ? Object.values(o.pending).every((p) => p === pendingPriority) : false;

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

      {o.pending && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas/50 px-3 py-2 text-[12.5px]">
          <span className="flex-1 text-body">
            {samePriority
              ? `Mark ${plural(pendingCount, "email")} ${pendingPriority} priority?`
              : `Change the priority of ${plural(pendingCount, "email")}?`}
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

      {o.show && o.show.length > 0 && uid && <SaveAsFolder outcome={o} folders={folders} uid={uid} />}
    </div>
  );
}

/** Saves the AI's result list as a new folder, or adds it to an existing one. */
function SaveAsFolder({
  outcome: o,
  folders,
  uid,
}: {
  outcome: Outcome;
  folders: { id: string; name: string }[];
  uid: string;
}) {
  const [name, setName] = useState(o.group ?? o.instruction.slice(0, 40));
  const [target, setTarget] = useState("new");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ id: string; name: string; added: number } | null>(null);

  const ids = new Set(o.show);
  const emails = getMessages().filter((m) => ids.has(m.id) && isFolderable(m));
  if (!emails.length) return null;

  async function save() {
    setSaving(true);
    try {
      if (target === "new") {
        const id = await createFolder(uid, name, o.instruction, emails);
        if (id) setSaved({ id, name: name.trim() || "Grouped emails", added: emails.length });
      } else {
        const added = await addToFolder(uid, target, emails);
        setSaved({ id: target, name: folders.find((f) => f.id === target)?.name ?? "folder", added });
      }
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <p className="mt-3 text-[12.5px] text-body">
        {saved.added ? `Saved ${plural(saved.added, "email")} to` : "Already in"}{" "}
        <Link href={`/grouped?folder=${saved.id}`} className="font-medium text-accent-text hover:underline">
          {saved.name}
        </Link>
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
      <FolderPlus className="size-4 shrink-0 text-accent-text" />
      {folders.length > 0 && (
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label="Folder"
          className="h-8 max-w-[9rem] rounded-lg border border-line bg-surface-2 px-2 text-[12.5px] text-body outline-none"
        >
          <option value="new">New folder</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      )}
      {target === "new" && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Folder name"
          maxLength={60}
          className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 text-[12.5px] text-ink outline-none focus:border-accent-text/60"
        />
      )}
      <button
        type="button"
        disabled={saving || (target === "new" && !name.trim())}
        onClick={() => void save()}
        className="h-8 shrink-0 rounded-lg bg-accent px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {saving ? "Saving…" : target === "new" ? "Save as folder" : "Add to folder"}
      </button>
    </div>
  );
}
