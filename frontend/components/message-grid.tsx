"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Inbox } from "lucide-react";
import { MessageCard } from "./message-card";
import { useStore } from "@/lib/store";
import type { Message } from "@/lib/types";

export function MessageGrid({
  messages,
  filtering = false,
}: {
  messages: Message[];
  filtering?: boolean;
}) {
  const { saved } = useStore();
  const savedIds = new Set(saved.filter((s) => !s.removed).map((s) => s.messageId));

  if (messages.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid place-items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center"
      >
        <Inbox className="size-6 text-muted" strokeWidth={1.5} />
        <p className="mt-3 text-[14px] font-medium">
          {filtering ? "No messages match" : "Nothing here yet"}
        </p>
        <p className="mt-1 text-[12.5px] text-muted">
          {filtering
            ? "Try a different search or priority filter."
            : "New conversations will show up here."}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="grid items-stretch gap-3 lg:grid-cols-2">
      <AnimatePresence mode="popLayout" initial>
        {messages.map((m, i) => (
          <MessageCard key={m.id} message={m} index={i} saved={savedIds.has(m.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
