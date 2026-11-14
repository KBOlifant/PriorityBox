"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Calendar, ChevronDown, ExternalLink, Pencil, Reply, Sparkles, Trash2 } from "lucide-react";
import { AiSummaryPanel, useAiSummary } from "./ai-summary";
import { FollowUp } from "./details-panel";
import { EmailModal } from "./email-modal";
import { PriorityBadge, PRIORITY_EDGE } from "./priority-badge";
import { RevealButton } from "./reveal-button";
import { useAuth } from "@/lib/auth";
import { markRead, useIsRead } from "@/lib/read";
import { COLORS, hash, initials, toMessage } from "@/lib/mail-map";
import { savedToMessage, unsaveMessage, updateSavedFields } from "@/lib/saved";
import { actions, useStore } from "@/lib/store";
import type { Message, Priority } from "@/lib/types";
import type { SavedRef } from "@/services/firestore/savedEmails";
import { MailError, providers } from "@/services/mail";
import { formatEventDate } from "@/services/mail/classifyParse";
import { messageLink } from "@/services/mail/parse";
import { timeAgo } from "@/services/mailCache";
import { loadSavedBody, storeSavedBody, type SavedBody } from "@/services/savedBodies";

/**
 * A saved email, tracked like a manual entry: activity, event date, progress
 * (meter set by the AI) and remarks, all editable. The email itself is not
 * stored; "Read email" fetches it from Gmail / Outlook on request.
 */
export function SavedCard({ item, index }: { item: SavedRef; index: number }) {
  const { user } = useAuth();
  const { messages } = useStore();
  const [reading, setReading] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [open, setOpen] = useState(false);
  const isRead = useIsRead(item.id);
  // The copy of the email kept on this device when it was saved, so it can be read without the inbox.
  const [kept, setKept] = useState<SavedBody | null>(() =>
    user ? loadSavedBody(user.uid, item.id) : null,
  );

  // The AI works on the user's notes, plus the real email when it is known.
  const loaded = messages.find((m) => m.id === item.messageId);
  const message = savedToMessage(item, loaded?.body ?? kept?.body);
  const ai = useAiSummary(message);

  const provider = providers[item.provider];
  const link = messageLink({
    provider: item.provider,
    account: item.account,
    id: item.messageId,
    webLink: item.webLink,
  });
  const edited = item.activity && item.activity !== item.subject;

  async function read() {
    // Already loaded in this session, or kept on this device: no need to go back to the mailbox.
    if (loaded) return setReading(loaded);
    if (kept) return setReading({ ...savedToMessage(item, kept.body), day: kept.day, time: kept.time });

    setBusy(true);
    setError("");
    try {
      if (!(await provider.restore(item.account))) {
        throw new MailError(
          `This email isn’t kept on this device and ${provider.label} isn’t connected. Connect it to read the email, or open it in ${provider.label.replace("Google ", "").replace("Microsoft ", "")}.`,
        );
      }
      const nativeId = item.messageId.slice(item.messageId.indexOf(":") + 1);
      const fetched = toMessage(await provider.fetchMessage(item.account, nativeId));
      if (user && fetched.body) {
        const entry = { body: fetched.body, day: fetched.day, time: fetched.time };
        storeSavedBody(user.uid, item.id, entry);
        setKept(entry);
      }
      setReading(fetched);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t load this email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 6) * 0.04 }}
      className={`group relative flex flex-col rounded-xl p-3 shadow-sm shadow-black/10 transition-shadow hover:shadow-md hover:shadow-black/15 ${PRIORITY_EDGE[item.priority]} ${isRead ? "bg-read" : "bg-surface"}`}
    >
      <div
        className={`absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-sm transition-opacity focus-within:opacity-100 group-hover:opacity-100 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        <RevealButton
          icon={<BookOpen className="size-4 shrink-0" />}
          label={busy ? "Loading…" : "Read email"}
          onClick={() => void read()}
        />
        {link && (
          <RevealButton
            icon={<ExternalLink className="size-4 shrink-0" />}
            label={`Open in ${provider.label.replace("Google ", "").replace("Microsoft ", "")}`}
            href={link}
            external
          />
        )}
        <RevealButton
          tone={followUp ? "accent" : "neutral"}
          icon={<Reply className="size-4 shrink-0" />}
          label={followUp ? "Hide follow-up" : "Write follow-up"}
          onClick={() => setFollowUp((v) => !v)}
        />
        <RevealButton
          icon={<Pencil className="size-4 shrink-0" />}
          label="Edit"
          onClick={() => actions.openManualEditor(item.id, true)}
        />
        <RevealButton
          icon={<Trash2 className="size-4 shrink-0" />}
          label="Remove"
          onClick={() => user && void unsaveMessage(user.uid, item.messageId)}
        />
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => {
          if (!open) markRead(item.id);
          setOpen(!open);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!open) markRead(item.id);
            setOpen(!open);
          }
        }}
        className="flex cursor-pointer gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[12px] font-semibold text-white/95"
          style={{ background: COLORS[hash(item.sender) % COLORS.length] }}
          aria-hidden
        >
          {initials(item.sender, item.sender)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[12.5px] text-muted">
              <span className={`text-[14.5px] text-ink ${isRead ? "font-normal" : "font-semibold"}`}>{item.sender}</span>
              <span>Saved {timeAgo(item.savedAt)}</span>
            </p>
            <span className="transition-opacity group-hover:opacity-0"><PriorityBadge priority={item.priority} /></span>
          </div>
          <h3
            title={item.activity}
            className={`mt-0.5 text-[14.5px] leading-snug ${isRead ? "font-normal" : "font-semibold"} ${open ? "line-clamp-2" : "line-clamp-1"}`}
          >
            {item.activity}
          </h3>
          {open && edited && (
            <p className="mt-1 truncate text-[12px] text-muted" title={item.subject}>
              Email: {item.subject}
            </p>
          )}
          {open && item.progressNote && (
            <p className="mt-1.5 line-clamp-3 text-[13.5px] leading-6 text-body">
              {item.progressNote}
            </p>
          )}
          {item.eventDate && (
            <span className="mt-3 inline-flex min-h-8 max-w-full items-center gap-2 rounded-lg border border-line bg-canvas/50 px-3 py-1 text-[12px] leading-snug text-body">
              <Calendar className="size-3.5 shrink-0 text-muted" />
              <span className="min-w-0">Event date</span>
              <span className="size-[3px] shrink-0 rounded-full bg-muted" />
              <span className="min-w-0">{formatEventDate(item.eventDate)}</span>
            </span>
          )}

          {open && <div className="mt-3.5">
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="font-medium">{item.stage}</span>
              <span className="tabular-nums text-muted">{item.percent}%</span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-track"
              role="progressbar"
              aria-valuenow={item.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress"
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#0a4f9c] to-[#2a78c8]"
                initial={{ width: 0 }}
                animate={{ width: `${item.percent}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              />
            </div>
          </div>}

          {open && item.remarks && (
            <p className="mt-3 line-clamp-2 text-[12.5px] leading-5 text-muted">
              <span className="font-medium text-body">Remarks: </span>
              {item.remarks}
            </p>
          )}
          {open && <p className="mt-3 text-[12px] text-muted">
            {provider.label} · {item.account}
            {item.auto ? " · saved automatically" : ""}
          </p>}
        </div>
      </div>

      {open && (
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <RevealButton
          // Red only for emails that need attention, like everywhere else.
          tone={item.priority === "High" ? "alert" : "soft"}
          icon={<Sparkles className="size-3.5 shrink-0" />}
          label={ai.label}
          disabled={ai.disabled}
          title={ai.hint}
          onClick={ai.toggle}
        />
        <label className="relative">
          <span className="sr-only">Priority for {item.activity}</span>
          <select
            value={item.priority}
            onChange={(e) =>
              user && void updateSavedFields(user.uid, item.id, { priority: e.target.value as Priority })
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
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[12.5px] leading-5 text-danger">
          {error}
        </p>
      )}

      <AnimatePresence initial={false}>
        {open && ai.state !== "closed" && <AiSummaryPanel key="summary" summary={ai} />}
      </AnimatePresence>

      {open && followUp && (
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-raised">
          <FollowUp message={message} />
        </div>
      )}

      <AnimatePresence>
        {reading && <EmailModal message={reading} onClose={() => setReading(null)} />}
      </AnimatePresence>
    </motion.article>
  );
}
