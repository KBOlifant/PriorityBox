"use client";

import { motion } from "framer-motion";
import { Bell, Plus, Search } from "lucide-react";
import { actions, useStore } from "@/lib/store";

export function Topbar() {
  const { query } = useStore();

  return (
    <header className="sticky top-0 z-20 flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-line bg-canvas/85 px-9 backdrop-blur-md">
      <label className="relative block w-full max-w-[420px]">
        <span className="sr-only">Search messages</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => actions.setQuery(e.target.value)}
          placeholder="Search people, subjects, or messages"
          className="h-10 w-full rounded-xl border border-line bg-surface pl-11 pr-4 text-[13px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent-line focus:ring-2 focus:ring-accent/20 [&::-webkit-search-cancel-button]:hidden"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid size-10 place-items-center rounded-xl text-body transition-colors hover:bg-white/[0.04] hover:text-ink"
        >
          <Bell className="size-[18px]" strokeWidth={1.7} />
          <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-[#C21E29]" />
        </button>
        <motion.button
          type="button"
          onClick={actions.openConnect}
          whileTap={{ scale: 0.97 }}
          className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[13px] font-medium transition-colors hover:border-[#38383d]"
        >
          <Plus className="size-4" />
          Add inbox
        </motion.button>
      </div>
    </header>
  );
}
