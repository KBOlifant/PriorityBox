"use client";

import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { PriorityBadge } from "./priority-badge";
import type { Message } from "@/lib/types";

export function EventHighlights({ messages }: { messages: Message[] }) {
  const items = messages.filter((m) => m.event).slice(0, 3);
  if (items.length === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((m, i) => (
        <motion.div
          key={m.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -2 }}
          className={`rounded-2xl border p-5 ${
            m.priority === "High"
              ? "border-[#3f2622] bg-[#1c1513]"
              : "border-[#33282a] bg-[#1a1516]"
          }`}
        >
          <div className="flex items-start justify-between">
            <span className="grid size-9 place-items-center rounded-xl border border-accent-line bg-accent-soft text-accent-text">
              <Calendar className="size-4" />
            </span>
            <PriorityBadge priority={m.priority} />
          </div>
          <p className="mt-5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">
            {m.event!.label}
          </p>
          <p className="mt-2 text-[19px] font-semibold tracking-tight">
            {m.event!.date}
          </p>
          <p className="mt-2 truncate text-[12px] text-muted">{m.subject}</p>
        </motion.div>
      ))}
    </div>
  );
}
