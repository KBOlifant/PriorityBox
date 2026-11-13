"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { PriorityBadge } from "./priority-badge";
import { RevealButton } from "./reveal-button";
import { DetailsPanel } from "./details-panel";
import { actions } from "@/lib/store";
import { summarizeEmail } from "@/services/groq";
import { downloadMessage, mailtoHref } from "@/lib/actions";
import type { Message, Priority } from "@/lib/types";

type SummaryState = "closed" | "loading" | "open";

const panelMotion = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

export function MessageCard({
  message: m,
  index,
}: {
  message: Message;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<SummaryState>("closed");
  const [summaryText, setSummaryText] = useState("");
  const [summaryError, setSummaryError] = useState("");
  // Real mail links straight to the message in Gmail / Outlook on the web.
  const link = m.webLink?.startsWith("https://") ? m.webLink : null;
  const summaryLabel =
    summary === "closed"
      ? "Summarize with AI"
      : summary === "loading"
        ? "Summarizing…"
        : "Hide AI summary";
  // Bumped on every toggle so a response that arrives after the panel was
  // closed (or the card unmounted) is ignored.
  const request = useRef(0);

  useEffect(() => {
    const r = request;
    return () => {
      r.current += 1;
    };
  }, []);

  function toggleSummary() {
    if (summary !== "closed") {
      request.current += 1;
      return setSummary("closed");
    }
    if (summaryText) return setSummary("open");
    void loadSummary();
  }

  async function loadSummary() {
    const id = ++request.current;
    setSummaryError("");
    setSummary("loading");
    try {
      const text = await summarizeEmail(m);
      if (id !== request.current) return;
      setSummaryText(text);
      setSummary("open");
    } catch (err) {
      if (id !== request.current) return;
      setSummaryError(err instanceof Error ? err.message : "Something went wrong.");
      setSummary("open");
    }
  }

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
        delay: Math.min(index, 6) * 0.04,
      }}
      whileHover={{ scale: 1.02 }}
      className="flex flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-[#323236]"
    >
      <div className="-mt-2 mb-2 -ml-2 flex items-center gap-1">
        <RevealButton
          icon={<Download className="size-4 shrink-0" />}
          label="Download"
          onClick={() => downloadMessage(m)}
        />
        {link ? (
          <RevealButton
            icon={<ExternalLink className="size-4 shrink-0" />}
            label={`Open in ${m.provider === "outlook" ? "Outlook" : "Gmail"}`}
            href={link}
            external
          />
        ) : (
          // Sample messages have no real email to open, so this starts a reply instead.
          <RevealButton
            icon={<ExternalLink className="size-4 shrink-0" />}
            label="Reply by email"
            href={mailtoHref(m)}
          />
        )}
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${open ? "Hide" : "Show"} details for ${m.subject}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="-m-1 flex cursor-pointer gap-3.5 rounded-xl p-1 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl text-[13px] font-semibold text-white/95"
          style={{ background: m.avatarColor }}
        >
          {m.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[12.5px] text-muted">
              <span className="text-[14.5px] font-semibold text-ink">
                {m.sender}
              </span>
              <span>{m.day}</span>
              <span className="size-[3px] self-center rounded-full bg-muted" />
              <span>{m.time}</span>
            </p>
            <PriorityBadge priority={m.priority} />
          </div>
          <h3 className="mt-1.5 text-[16px] font-semibold leading-snug">
            {m.subject}
          </h3>
          <p className="mt-1.5 pr-10 text-[13.5px] leading-6 text-body">
            {m.preview}
          </p>
          {m.event && (
            <span className="mt-3 inline-flex min-h-8 max-w-full items-center gap-2 rounded-lg border border-line bg-canvas/50 px-3 py-1 text-[12px] leading-snug text-body">
              <Calendar className="size-3.5 shrink-0 text-muted" />
              <span className="min-w-0">{m.event.label}</span>
              <span className="size-[3px] shrink-0 rounded-full bg-muted" />
              <span className="min-w-0">{m.event.date}</span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-line pt-4">
        <RevealButton
          tone="alert"
          icon={<Sparkles className="size-3.5 shrink-0" />}
          label={summaryLabel}
          onClick={toggleSummary}
        />

        <label className="relative">
          <span className="sr-only">Priority for {m.subject}</span>
          <select
            value={m.priority}
            onChange={(e) =>
              actions.setPriority(m.id, e.target.value as Priority)
            }
            className="h-9 cursor-pointer appearance-none rounded-lg border border-line bg-surface-2 pl-3.5 pr-9 text-[13px] text-body outline-none transition-colors hover:border-[#38383d] focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {(["High", "Medium", "Low"] as const).map((p) => (
              <option key={p} value={p}>
                {p} Priority
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-body" />
        </label>

        <div className="ml-auto flex items-center gap-1">
          {m.archived ? (
            <span className="flex h-9 items-center gap-1.5 px-2 text-[13px] font-medium text-muted">
              <Check className="size-4" />
              Completed
            </span>
          ) : (
            <RevealButton
              tone="accent"
              icon={<Check className="size-4 shrink-0" />}
              label="Complete"
              onClick={() => actions.complete(m.id)}
            />
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {summary !== "closed" && (
          <motion.div key="summary" {...panelMotion} className="overflow-hidden">
            <div className="mt-4 rounded-xl border border-accent-line bg-accent-soft p-4">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-text">
                <Sparkles className="size-3.5" />
                AI summary
              </p>
              {summary === "loading" ? (
                <div className="mt-3 space-y-2" aria-live="polite">
                  <div className="h-3 w-full animate-pulse rounded bg-accent-line/70" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-accent-line/70" />
                  <div className="h-3 w-3/5 animate-pulse rounded bg-accent-line/70" />
                </div>
              ) : summaryError ? (
                <p role="alert" className="mt-2.5 text-[13.5px] leading-6 text-[#f0a090]">
                  {summaryError}{" "}
                  <button
                    type="button"
                    onClick={() => void loadSummary()}
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
                  {summaryText}
                </motion.p>
              )}
            </div>
          </motion.div>
        )}
        {open && (
          <motion.div key="details" {...panelMotion} className="overflow-hidden">
            <DetailsPanel message={m} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
