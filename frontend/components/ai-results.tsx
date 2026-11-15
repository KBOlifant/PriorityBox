"use client";

import { motion } from "framer-motion";
import { ArrowLeft, CheckSquare, Sparkles } from "lucide-react";
import { MessageGrid } from "./message-grid";
import { actions, useStore } from "@/lib/store";
import type { Message } from "@/lib/types";

/** The emails the AI found, shown in place of the inbox until the user goes back. */
export function AiResults({ all, visible, query }: { all: Message[]; visible: Message[]; query: string }) {
  const { selected } = useStore();
  const allTicked = visible.length > 0 && visible.every((m) => selected.includes(m.id));

  return (
    <motion.section
      key={query}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-10"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-8 place-items-center rounded-lg border border-accent-line bg-accent-soft text-accent-text">
          <Sparkles className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">
            AI results <span className="ml-1 text-[13px] font-normal text-muted">{visible.length === all.length ? all.length : `${visible.length} of ${all.length}`} emails</span>
          </h2>
          <p className="truncate text-[12.5px] text-muted" title={query}>
            “{query}”
          </p>
        </div>
        {visible.length > 0 && (
          <button
            type="button"
            onClick={() => actions.selectMany(visible.map((m) => m.id), !allTicked)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-body transition-colors hover:border-line-strong hover:text-ink"
          >
            <CheckSquare className="size-4" />
            {allTicked ? "Unselect all" : "Select all"}
          </button>
        )}
        <button
          type="button"
          onClick={() => actions.setAiFilter(null)}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          <ArrowLeft className="size-4" />
          Back to inbox
        </button>
      </div>
      <div className="mt-4">
        <MessageGrid messages={visible} filtering />
      </div>
    </motion.section>
  );
}
