"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Check, Copy, Loader2, Send, Sparkles } from "lucide-react";
import { generate } from "@/lib/ai";
import { useProfile } from "@/lib/auth";
import { actions } from "@/lib/store";
import { mailtoHref } from "@/lib/actions";
import type { Message } from "@/lib/types";

const eyebrow =
  "text-[10px] font-semibold uppercase tracking-[0.18em] text-muted";

export function DetailsPanel({ message: m }: { message: Message }) {
  const { stage, percent } = m.progress;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-line bg-[#171719]">
      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div>
          <p className={eyebrow}>Progress</p>
          <div className="mt-2 flex items-baseline justify-between text-[14px]">
            <span className="font-medium">{stage}</span>
            <span className="text-[11px] tabular-nums text-muted">
              {percent}%
            </span>
          </div>
          <div
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#2b2b2f]"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress"
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#c0584a] to-[#d8695a]"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            />
          </div>

          {m.event && (
            <div className="mt-4 rounded-lg border border-[#3a2a22] bg-[#1d1614] p-3">
              <p className={eyebrow}>Important date</p>
              <p className="mt-2 flex gap-2 text-[13px] font-medium leading-snug">
                <Calendar className="mt-0.5 size-3.5 shrink-0 text-muted" />
                {m.event.label}: {m.event.date}
              </p>
            </div>
          )}

          {m.tags.length > 0 && (
            <div className="mt-3.5 flex flex-wrap gap-2">
              {m.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-surface-2 px-2.5 py-1 text-[11px] text-body"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label htmlFor={`remarks-${m.id}`} className={eyebrow}>
            Remarks
          </label>
          <textarea
            id={`remarks-${m.id}`}
            value={m.remarks}
            onChange={(e) => actions.setRemarks(m.id, e.target.value)}
            placeholder="Add a note for yourself…"
            className="mt-2 h-20 w-full resize-none rounded-lg border border-line bg-canvas/60 p-3 text-[13px] leading-5 text-ink outline-none transition-colors placeholder:text-muted focus:border-accent-line focus:ring-2 focus:ring-accent/20"
          />
          <p className="mt-2 text-right text-[11px] text-muted">Saved locally</p>
        </div>
      </div>

      {percent < 100 && <FollowUp message={m} />}
    </div>
  );
}

function FollowUp({ message: m }: { message: Message }) {
  const { name: userName } = useProfile();
  const [state, setState] = useState<"idle" | "loading" | "ready">("idle");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    const t = timers.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      t.forEach(clearTimeout);
    };
  }, []);

  async function write() {
    setState("loading");
    setError("");
    try {
      const text = await generate("draft", m, userName);
      if (!mounted.current) return;
      setDraft(text);
      setState("ready");
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setState("idle");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      timers.current.push(setTimeout(() => setCopied(false), 1600));
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="border-t border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            <Sparkles className="size-3.5 text-accent-text" />
            AI follow-up assistant
          </p>
          <p className="mt-1.5 text-[11.5px] text-muted">
            Progress is incomplete. Draft a context-aware reply or approval.
          </p>
        </div>
        {state !== "ready" && (
          <motion.button
            type="button"
            onClick={() => void write()}
            disabled={state === "loading"}
            whileTap={{ scale: 0.97 }}
            className="flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-70"
          >
            {state === "loading" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {state === "loading" ? "Drafting…" : "Write follow-up"}
          </motion.button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[12.5px] text-[#f0a090]">
          {error}
        </p>
      )}

      {state === "ready" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-4 rounded-xl border border-accent-line bg-[#2a1411] p-3"
        >
          <p className="px-1 pb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-text">
            Draft reply
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Draft reply"
            className="h-44 w-full resize-none rounded-lg border border-line bg-[#171112] p-3 text-[13px] leading-6 text-ink outline-none focus:border-accent-line"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={copy}
              className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3.5 text-[12.5px] text-body transition-colors hover:text-ink"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy draft"}
            </button>
            <a
              href={mailtoHref(m, draft)}
              className="flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              <Send className="size-3.5" />
              Open in email app
            </a>
          </div>
        </motion.div>
      )}
    </div>
  );
}
