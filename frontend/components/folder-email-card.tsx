"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ExternalLink, FolderMinus, Loader2 } from "lucide-react";
import { EmailModal } from "./email-modal";
import { PriorityBadge } from "./priority-badge";
import { RevealButton } from "./reveal-button";
import { useAuth } from "@/lib/auth";
import { removeFromFolder } from "@/lib/folders";
import { COLORS, hash, initials, when } from "@/lib/mail-map";
import { markRead, useIsRead } from "@/lib/read";
import type { Message } from "@/lib/types";
import { useReferencedEmail } from "@/lib/use-referenced-email";
import type { FolderItemRef } from "@/services/firestore/folders";
import { messageLink } from "@/services/mail/parse";

/** One email in a "Grouped Emails" folder: a reference, with the email loaded on demand. */
export function FolderEmailCard({
  item,
  folderId,
  index,
}: {
  item: FolderItemRef;
  folderId: string;
  index: number;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState<Message | null>(null);
  const [truncated, setTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const isRead = useIsRead(item.messageId);
  const { email, loaded, status, error, load, appName } = useReferencedEmail(item);
  const { day, time } = when(item.receivedAt || item.addedAt);
  const link = messageLink({ provider: item.provider, account: item.account, id: item.messageId, webLink: item.webLink || undefined });

  useEffect(() => {
    if (!open) return;
    const el = textRef.current;
    if (el) setTruncated(el.scrollHeight > el.clientHeight + 1);
  }, [open, email?.body]);

  function toggleOpen() {
    if (!open) {
      markRead(item.messageId);
      if (!email && status === "idle") void load(false);
    }
    setOpen(!open);
  }

  async function read() {
    const m = await load(true);
    if (m) setReading(m);
  }

  const snippet = email?.preview && email.preview !== item.subject ? email.preview : "";

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 6) * 0.04 }}
      className={`group relative flex min-w-0 flex-col rounded-xl ${open ? "p-3" : "p-2"} shadow-sm shadow-black/10 transition-shadow hover:shadow-md hover:shadow-black/15 ${isRead ? "bg-read" : "bg-surface"}`}
    >
      <div
        className={`absolute right-3 top-2 z-10 flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-sm transition-opacity focus-within:opacity-100 group-hover:opacity-100 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        <RevealButton
          icon={<BookOpen className="size-4 shrink-0" />}
          label={status === "loading" ? "Loading…" : "Read email"}
          onClick={() => void read()}
        />
        {link && (
          <RevealButton
            icon={<ExternalLink className="size-4 shrink-0" />}
            label={`Open in ${appName}`}
            href={link}
            external
          />
        )}
        <RevealButton
          icon={<FolderMinus className="size-4 shrink-0" />}
          label="Remove from folder"
          onClick={() => user && void removeFromFolder(user.uid, folderId, item.id)}
        />
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${open ? "Hide" : "Show"} ${item.subject}`}
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
          style={{ background: COLORS[hash(item.senderEmail || item.sender) % COLORS.length] }}
          aria-hidden
        >
          {initials(item.sender, item.senderEmail)}
        </span>

        {!open ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className={`w-36 shrink-0 truncate text-[14px] text-ink ${isRead ? "font-normal" : "font-semibold"}`}>
              {item.sender}
            </span>
            <p className="min-w-0 flex-1 truncate text-[13px] text-body">
              <span className={`text-ink ${isRead ? "font-normal" : "font-semibold"}`}>{item.subject}</span>
              {snippet && <span className="text-muted"> – {snippet}</span>}
            </p>
            <span className="shrink-0 text-[12px] text-muted">
              {day} · {time}
            </span>
            {loaded && (
              <span className="shrink-0 transition-opacity group-hover:opacity-0">
                <PriorityBadge priority={loaded.priority} />
              </span>
            )}
          </div>
        ) : (
          <div className="min-w-0 flex-1 pr-28">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[12.5px] text-muted">
              <span className={`text-[14.5px] text-ink ${isRead ? "font-normal" : "font-semibold"}`}>{item.sender}</span>
              <span>{day}</span>
              <span className="size-[3px] self-center rounded-full bg-muted" />
              <span>{time}</span>
            </p>
            <h3 className={`mt-0.5 line-clamp-2 text-[14.5px] leading-snug ${isRead ? "font-normal" : "font-semibold"}`}>
              {item.subject}
            </h3>
            {email?.body && (
              <p ref={textRef} className="mt-1.5 line-clamp-5 whitespace-pre-line text-[13px] leading-5 text-body">
                {email.body}
              </p>
            )}
            {!email?.body && status === "loading" && (
              <p className="mt-1.5 flex items-center gap-2 text-[12.5px] text-muted">
                <Loader2 className="size-3.5 animate-spin" /> Loading the email from {appName}…
              </p>
            )}
            {!email?.body && status === "needs-connect" && (
              <p className="mt-1.5 text-[12.5px] text-muted">
                The email isn’t on this device.{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation(); // don't collapse the card
                    void load(true);
                  }}
                  className="font-medium text-accent-text hover:text-ink"
                >
                  Load it from {appName}
                </button>
              </p>
            )}
            <p className="mt-2 text-[12px] text-muted">
              {appName} · {item.account}
            </p>
          </div>
        )}
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

      {error && (
        <p role="alert" className="ml-11 mt-2 text-[12.5px] leading-5 text-danger">
          {error}
        </p>
      )}

      <AnimatePresence>
        {reading && <EmailModal message={reading} onClose={() => setReading(null)} />}
      </AnimatePresence>
    </motion.article>
  );
}
