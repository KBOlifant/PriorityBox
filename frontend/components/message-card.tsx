"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Calendar,
  Pencil,
  Trash2,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { AiSummaryPanel, panelMotion, useAiSummary } from "./ai-summary";
import { PriorityBadge } from "./priority-badge";
import { EmailModal } from "./email-modal";
import { messageLink } from "@/services/mail/parse";
import { RevealButton } from "./reveal-button";
import { DetailsPanel } from "./details-panel";
import { useAuth } from "@/lib/auth";
import { deleteManualEntry } from "@/lib/manual";
import { isSavable, saveMessage, unsaveMessage } from "@/lib/saved";
import { needsAttention } from "@/lib/selectors";
import { actions } from "@/lib/store";
import { downloadMessage, mailtoHref } from "@/lib/actions";
import type { Message, Priority } from "@/lib/types";

export function MessageCard({
  message: m,
  index,
  saved = false,
}: {
  message: Message;
  index: number;
  /** Whether this email is in the user's saved-for-later list. */
  saved?: boolean;
}) {
  const { user } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const manual = m.provider === "manual";
  const [open, setOpen] = useState(false);
  // "Read full email" opens the whole message in a dialog; the button only exists once the card is expanded.
  const [reading, setReading] = useState(false);
  const closeReader = useCallback(() => setReading(false), []);
  const [truncated, setTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const ai = useAiSummary(m);
  // Real mail links straight to the message in Gmail / Outlook on the web.
  const link = messageLink(m);
  // Is there more email than the 5-line view shows? Decides whether to offer the button.
  useEffect(() => {
    if (!open) return;
    const el = textRef.current;
    if (el) setTruncated(el.scrollHeight > el.clientHeight + 1);
  }, [open, m.body, m.preview]);

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  function toggleOpen() {
    setOpen(!open);
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
      className="flex flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong"
    >
      <div className="-mt-2 mb-2 -ml-2 flex items-center gap-1">
        {manual ? (
          <>
            <RevealButton
              icon={<Pencil className="size-4 shrink-0" />}
              label="Edit"
              onClick={() => actions.openManualEditor(m.id.slice("manual:".length))}
            />
            <RevealButton
              tone={confirmDelete ? "alert" : "neutral"}
              icon={<Trash2 className="size-4 shrink-0" />}
              label={confirmDelete ? "Click again to delete" : "Delete"}
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                if (user) void deleteManualEntry(user.uid, m.id.slice("manual:".length));
              }}
            />
          </>
        ) : (
          <>
            <RevealButton
              icon={<Download className="size-4 shrink-0" />}
              label="Download"
              onClick={() => downloadMessage(m)}
            />
            {isSavable(m) && user && (
              <RevealButton
                icon={
                  saved ? (
                    <BookmarkCheck className="size-4 shrink-0 text-accent-text" />
                  ) : (
                    <Bookmark className="size-4 shrink-0" />
                  )
                }
                label={saved ? "Remove from saved" : "Save for later"}
                onClick={() =>
                  void (saved ? unsaveMessage(user.uid, m.id) : saveMessage(user.uid, m))
                }
              />
            )}
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
          </>
        )}
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${open ? "Hide" : "Show"} details for ${m.subject}`}
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleOpen();
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
          <h3
            title={m.subject}
            className="mt-1.5 line-clamp-2 text-[16px] font-semibold leading-snug"
          >
            {m.subject}
          </h3>
          <p
            ref={textRef}
            className={`mt-1.5 pr-10 text-[13.5px] leading-6 text-body ${
              open ? "line-clamp-5" : "line-clamp-3"
            }`}
          >
            {open ? (m.body ?? m.preview) : m.preview}
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

      {/* Only an expanded card offers the whole email, and only if there is more to read. */}
      {open && truncated && (
        <button
          type="button"
          onClick={() => setReading(true)}
          aria-haspopup="dialog"
          className="ml-[54px] mt-3 flex items-center gap-1.5 self-start rounded-lg text-[12.5px] font-medium text-accent-text outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <BookOpen className="size-3.5" />
          Read full email
        </button>
      )}

      <div className="mt-5 flex items-center gap-2 border-t border-line pt-4">
        <RevealButton
          // Red only for emails that need attention; everything else stays blue.
          tone={needsAttention(m) ? "alert" : "soft"}
          icon={<Sparkles className="size-3.5 shrink-0" />}
          label={ai.label}
          disabled={ai.disabled}
          title={ai.hint}
          onClick={ai.toggle}
        />

        <label className="relative">
          <span className="sr-only">Priority for {m.subject}</span>
          <select
            value={m.priority}
            onChange={(e) =>
              actions.setPriority(m.id, e.target.value as Priority)
            }
            className="h-9 cursor-pointer appearance-none rounded-lg border border-line bg-surface-2 pl-3.5 pr-9 text-[13px] text-body outline-none transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-accent/40"
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
        {ai.state !== "closed" && <AiSummaryPanel key="summary" summary={ai} />}
        {open && (
          <motion.div key="details" {...panelMotion} className="overflow-hidden">
            <DetailsPanel message={m} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {reading && <EmailModal message={m} onClose={closeReader} />}
      </AnimatePresence>
    </motion.article>
  );
}
