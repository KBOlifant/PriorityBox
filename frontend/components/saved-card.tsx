"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ExternalLink, Trash2 } from "lucide-react";
import { EmailModal } from "./email-modal";
import { PriorityBadge } from "./priority-badge";
import { RevealButton } from "./reveal-button";
import { useAuth } from "@/lib/auth";
import { COLORS, hash, initials, toMessage } from "@/lib/mail-map";
import { unsaveMessage } from "@/lib/saved";
import { useStore } from "@/lib/store";
import type { Message } from "@/lib/types";
import type { SavedRef } from "@/services/firestore/savedEmails";
import { MailError, providers } from "@/services/mail";
import { timeAgo } from "@/services/mailCache";

/**
 * A saved-for-later reference. Only the sender and subject are stored; the email
 * itself is fetched from Gmail / Outlook when the user asks to read it.
 */
export function SavedCard({ item, index }: { item: SavedRef; index: number }) {
  const { user } = useAuth();
  const { messages } = useStore();
  const [reading, setReading] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const provider = providers[item.provider];
  const link = item.webLink?.startsWith("https://") ? item.webLink : null;

  async function read() {
    // Already loaded in this session: no need to go back to the mailbox.
    const loaded = messages.find((m) => m.id === item.messageId);
    if (loaded) return setReading(loaded);

    setBusy(true);
    setError("");
    try {
      if (!(await provider.restore(item.account))) {
        throw new MailError(`Connect ${provider.label} again to read this email.`);
      }
      const nativeId = item.messageId.slice(item.messageId.indexOf(":") + 1);
      setReading(toMessage(await provider.fetchMessage(item.account, nativeId)));
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
            title={item.subject}
            className="mt-1.5 line-clamp-2 text-[16px] font-semibold leading-snug"
          >
            {item.subject}
          </h3>
          <p className="mt-1.5 text-[12px] text-muted">
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

      <AnimatePresence>
        {reading && <EmailModal message={reading} onClose={() => setReading(null)} />}
      </AnimatePresence>
    </motion.article>
  );
}
