"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Calendar, ChevronDown, ExternalLink, Pencil, Reply, Sparkles, Trash2 } from "lucide-react";
import { AiSummaryPanel, useAiSummary } from "./ai-summary";
import { FollowUp } from "./details-panel";
import { EmailModal } from "./email-modal";
import { PriorityBadge } from "./priority-badge";
import { RevealButton } from "./reveal-button";
import { useAuth } from "@/lib/auth";
import { COLORS, hash, initials, toMessage } from "@/lib/mail-map";
import { savedToMessage, unsaveMessage, updateSavedFields } from "@/lib/saved";
import { actions, useStore } from "@/lib/store";
import type { Message, Priority } from "@/lib/types";
import type { SavedRef } from "@/services/firestore/savedEmails";
import { MailError, providers } from "@/services/mail";
import { formatEventDate } from "@/services/mail/classifyParse";
import { messageLink } from "@/services/mail/parse";
import { timeAgo } from "@/services/mailCache";

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
  // The real email body, once it has been read this session.
  const [liveBody, setLiveBody] = useState<string | undefined>();

  // The AI works on the user's notes, plus the real email when it is known.
  const loaded = messages.find((m) => m.id === item.messageId);
  const message = savedToMessage(item, loaded?.body ?? liveBody);
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
    // Already loaded in this session: no need to go back to the mailbox.
    if (loaded) return setReading(loaded);

    setBusy(true);
    setError("");
    try {
      if (!(await provider.restore(item.account))) {
        throw new MailError(`Connect ${provider.label} again to read this email.`);
      }
      const nativeId = item.messageId.slice(item.messageId.indexOf(":") + 1);
      const fetched = toMessage(await provider.fetchMessage(item.account, nativeId));
      setLiveBody(fetched.body);
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
      className="flex flex-col rounded-2xl border border-line bg-surface p-5"
    >
      <div className="flex gap-3.5">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl text-[13px] font-semibold text-white/95"
          style={{ background: COLORS[hash(item.sender) % COLORS.length] }}
          aria-hidden
        >
          {initials(item.sender, item.sender)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[12.5px] text-muted">
              <span className="text-[14.5px] font-semibold text-ink">{item.sender}</span>
              <span>Saved {timeAgo(item.savedAt)}</span>
            </p>
            <PriorityBadge priority={item.priority} />
          </div>
          <h3
            title={item.activity}
            className="mt-1.5 line-clamp-2 text-[16px] font-semibold leading-snug"
          >
            {item.activity}
          </h3>
          {edited && (
            <p className="mt-1 truncate text-[12px] text-muted" title={item.subject}>
              Email: {item.subject}
            </p>
          )}
          {item.progressNote && (
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

          <div className="mt-3.5">
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="font-medium">{item.stage}</span>
              <span className="tabular-nums text-muted">{item.percent}%</span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#2b2b2f]"
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
          </div>

          {item.remarks && (
            <p className="mt-3 line-clamp-2 text-[12.5px] leading-5 text-muted">
              <span className="font-medium text-body">Remarks: </span>
              {item.remarks}
            </p>
          )}
          <p className="mt-3 text-[12px] text-muted">
            {provider.label} · {item.account}
            {item.auto ? " · saved automatically" : ""}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-1 border-t border-line pt-4">
        <RevealButton
          tone="soft"
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
          // Red only for emails that need attention, like everywhere else.
          tone={item.priority === "High" ? "alert" : "soft"}
          icon={<Sparkles className="size-3.5 shrink-0" />}
          label={ai.label}
          onClick={ai.toggle}
        />
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

        <label className="relative ml-2">
          <span className="sr-only">Priority for {item.activity}</span>
          <select
            value={item.priority}
            onChange={(e) =>
              user && void updateSavedFields(user.uid, item.id, { priority: e.target.value as Priority })
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

        <div className="ml-auto">
          <RevealButton
            icon={<Trash2 className="size-4 shrink-0" />}
            label="Remove"
            onClick={() => user && void unsaveMessage(user.uid, item.messageId)}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[12.5px] leading-5 text-[#f0a090]">
          {error}
        </p>
      )}

      <AnimatePresence initial={false}>
        {ai.state !== "closed" && <AiSummaryPanel key="summary" summary={ai} />}
      </AnimatePresence>

      {followUp && (
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-[#171719]">
          <FollowUp message={message} />
        </div>
      )}

      <AnimatePresence>
        {reading && <EmailModal message={reading} onClose={() => setReading(null)} />}
      </AnimatePresence>
    </motion.article>
  );
}
