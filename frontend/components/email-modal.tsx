"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import type { Message } from "@/lib/types";

/** The whole email in a dialog. Closes on Escape, the backdrop, or the close button. */
export function EmailModal({
  message: m,
  onClose,
}: {
  message: Message;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // keep the page from scrolling behind the dialog
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const link = m.webLink?.startsWith("https://") ? m.webLink : null;
  const titleId = `email-title-${m.id}`;

  // Rendered in a portal: the card has a hover transform, which would otherwise
  // become the positioning context for this fixed overlay.
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-line bg-[#171719] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] [overflow-wrap:anywhere]"
      >
        <header className="flex items-start gap-4 border-b border-line px-6 py-5">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl text-[13px] font-semibold text-white/95"
            style={{ background: m.avatarColor }}
            aria-hidden
          >
            {m.initials}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[17px] font-semibold leading-snug">
              {m.subject}
            </h2>
            <p className="mt-1 text-[12.5px] text-muted">
              {m.sender}
              {m.email && m.email !== m.sender ? ` <${m.email}>` : ""} · {m.day}, {m.time}
            </p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted outline-none transition-colors hover:bg-white/[0.05] hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="overflow-y-auto px-6 py-5">
          <p className="whitespace-pre-line text-[14px] leading-7 text-body">
            {m.body ?? m.preview}
          </p>
        </div>

        {link && (
          <footer className="flex justify-end border-t border-line px-6 py-3.5">
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-medium text-body transition-colors hover:text-ink"
            >
              <ExternalLink className="size-3.5" />
              Open in {m.provider === "outlook" ? "Outlook" : "Gmail"}
            </a>
          </footer>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
