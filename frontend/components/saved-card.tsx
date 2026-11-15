"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Calendar, ChevronDown, ExternalLink, Loader2, Pencil, Reply, Sparkles, Trash2 } from "lucide-react";
import { AiSummaryPanel, useAiSummary } from "./ai-summary";
import { FollowUp } from "./details-panel";
import { EmailModal } from "./email-modal";
import { PriorityBadge, PriorityLip, PRIORITY_LIP_PAD } from "./priority-badge";
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
  const [error, setError] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [open, setOpen] = useState(false);
  const isRead = useIsRead(item.id);
  // The copy of the email kept on this device when it was saved, so it can be read without the inbox.
  const [kept, setKept] = useState<SavedBody | null>(() =>
    user ? loadSavedBody(user.uid, item.id) : null,
  );

  // Fetched from the mailbox in this view (kept too, but also covers an email with no body).
  const [fetched, setFetched] = useState<Message | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "needs-connect">("idle");
  const [truncated, setTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  // The AI works on the user's notes, plus the real email when it is known.
  const loaded = messages.find((m) => m.id === item.messageId);
  // The email itself, from wherever it is already available: this session, this device, or a fetch.
  const email: Message | null = loaded?.body
    ? loaded
    : kept
      ? { ...savedToMessage(item, kept.body), day: kept.day, time: kept.time }
      : fetched;
  const message = savedToMessage(item, email?.body);
  const ai = useAiSummary(message);

  const provider = providers[item.provider];
  const link = messageLink({
    provider: item.provider,
    account: item.account,
    id: item.messageId,
    webLink: item.webLink,
  });
  const edited = item.activity && item.activity !== item.subject;
  const appName = provider.label.replace("Google ", "").replace("Microsoft ", "");
  const busy = status === "loading";

  /**
   * Gets the email from the mailbox by its id. `interactive` is only true after a
   * click: it may show a sign-in. Otherwise it only fetches if the account already
   * has a valid session, so expanding a card never opens a pop-up or browser.
   */
  async function fetchEmail(interactive: boolean): Promise<Message | null> {
    if (email) return email;
    setStatus("loading");
    setError("");
    try {
      const ready = interactive
        ? await provider.restore(item.account)
        : await provider.hasSession(item.account);
      if (!ready) {
        if (!interactive) {
          setStatus("needs-connect");
          return null;
        }
        throw new MailError(
          `This email isn’t kept on this device and ${provider.label} isn’t connected. Connect it to read the email, or open it in ${appName}.`,
        );
      }
      const nativeId = item.messageId.slice(item.messageId.indexOf(":") + 1);
      const got = toMessage(await provider.fetchMessage(item.account, nativeId));
      if (got.body) {
        const entry = { body: got.body, day: got.day, time: got.time };
        if (user) storeSavedBody(user.uid, item.id, entry);
        setKept(entry);
      }
      setFetched(got);
      setStatus("idle");
      return got;
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Couldn’t load this email.");
      return null;
    }
  }

  async function read() {
    const got = await fetchEmail(true);
    if (got) setReading(got);
  }

  // Is there more email than the 5-line view shows? Decides whether to offer "Read full email".
  useEffect(() => {
    if (!open) return;
    const el = textRef.current;
    if (el) setTruncated(el.scrollHeight > el.clientHeight + 1);
  }, [open, email?.body]);

  function toggleOpen() {
    if (!open) {
      markRead(item.id);
      // Expanding shows the email itself, fetched by reference if it isn't here yet.
      if (!email && status === "idle") void fetchEmail(false);
    }
    setOpen(!open);
  }

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 6) * 0.04 }}
      className={`group relative flex min-w-0 flex-col rounded-xl ${open ? "p-3" : "p-2"} shadow-sm shadow-black/10 transition-shadow hover:shadow-md hover:shadow-black/15 ${PRIORITY_LIP_PAD} ${isRead ? "bg-read" : "bg-surface"}`}
    >
      <PriorityLip priority={item.priority} />
      <div
        className={`absolute right-11 top-2 z-10 flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-sm transition-opacity focus-within:opacity-100 group-hover:opacity-100 ${
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
        aria-label={`${open ? "Hide" : "Show"} details for ${item.activity}`}
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleOpen();
          }
        }}
        className={`flex cursor-pointer gap-3 rounded-lg outline-none ${open ? "" : "items-center"} focus-visible:ring-2 focus-visible:ring-accent/40`}
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[12px] font-semibold text-white/95"
          style={{ background: COLORS[hash(item.sender) % COLORS.length] }}
          aria-hidden
        >
          {initials(item.sender, item.sender)}
        </span>
        {!open && (
          // Collapsed: one Gmail-style line, like the inbox cards.
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className={`w-36 shrink-0 truncate text-[14px] text-ink ${isRead ? "font-normal" : "font-semibold"}`}
            >
              {item.sender}
            </span>
            <p className="min-w-0 flex-1 truncate text-[13px] text-body">
              <span className={`text-ink ${isRead ? "font-normal" : "font-semibold"}`}>{item.activity}</span>
              {(item.progressNote || edited) && (
                <span className="text-muted"> – {item.progressNote || item.subject}</span>
              )}
            </p>
            <span className="shrink-0 text-[12px] text-muted">Saved {timeAgo(item.savedAt)}</span>
            <span className="shrink-0 transition-opacity group-hover:opacity-0">
              <PriorityBadge priority={item.priority} />
            </span>
          </div>
        )}
        <div className={`min-w-0 flex-1 ${open ? "" : "hidden"}`}>
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
          {open && email?.body && (
            <p ref={textRef} className="mt-1.5 line-clamp-5 whitespace-pre-line text-[13px] leading-5 text-body">
              {email.body}
            </p>
          )}
          {open && !email?.body && busy && (
            <p className="mt-1.5 flex items-center gap-2 text-[12.5px] text-muted">
              <Loader2 className="size-3.5 animate-spin" /> Loading the email from {appName}…
            </p>
          )}
          {open && !email?.body && status === "needs-connect" && (
            <p className="mt-1.5 text-[12.5px] text-muted">
              The email isn’t on this device.{" "}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation(); // don't collapse the card
                  void fetchEmail(true);
                }}
                className="font-medium text-accent-text hover:text-ink"
              >
                Load it from {appName}
              </button>
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

      {open && email && truncated && (
        <button
          type="button"
          onClick={() => setReading(email)}
          aria-haspopup="dialog"
          className="ml-11 mt-2 flex items-center gap-1.5 self-start rounded-lg text-[12.5px] font-medium text-accent-text outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <BookOpen className="size-3.5" />
          Read full email
        </button>
      )}

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
