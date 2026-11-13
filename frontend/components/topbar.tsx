"use client";

import { motion } from "framer-motion";
import { Bell, Plus, RefreshCw, Search } from "lucide-react";
import { AiBar } from "./ai-bar";
import { ModeSwitch } from "./mode-switch";
import { SettingsMenu } from "./settings-menu";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "@/lib/auth";
import { syncMail } from "@/lib/mail";
import { actions, useStore } from "@/lib/store";

export function Topbar() {
  const { query, usingSample, sync, mode } = useStore();
  const { user } = useAuth();
  const syncing = sync.status === "loading" || sync.status === "classifying";

  return (
    <header className="sticky top-0 z-20 flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-line bg-canvas/85 px-9 backdrop-blur-md">
      <div className="flex min-w-0 flex-1 items-center gap-3">
      <label className="relative block w-full max-w-[300px]">
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
      <AiBar />
      </div>

      <div className="flex items-center gap-3">
        {mode === "mail" && !usingSample && user && (
          <button
            type="button"
            aria-label="Refresh mail"
            title="Refresh mail"
            disabled={syncing}
            onClick={() => void syncMail(user.uid)}
            className="grid size-10 place-items-center rounded-xl text-body transition-colors hover:bg-hover hover:text-ink disabled:opacity-60"
          >
            <RefreshCw
              className={`size-[18px] ${syncing ? "animate-spin" : ""}`}
              strokeWidth={1.7}
            />
          </button>
        )}
        <ModeSwitch />
        <ThemeToggle />
        <SettingsMenu />
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid size-10 place-items-center rounded-xl text-body transition-colors hover:bg-hover hover:text-ink"
        >
          <Bell className="size-[18px]" strokeWidth={1.7} />
          <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-[#C21E29]" />
        </button>
        {mode === "manual" ? (
          <motion.button
            type="button"
            onClick={() => actions.openManualEditor()}
            whileTap={{ scale: 0.97 }}
            className="flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <Plus className="size-4" />
            New entry
          </motion.button>
        ) : (
          <motion.button
            type="button"
            onClick={actions.openConnect}
            whileTap={{ scale: 0.97 }}
            className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[13px] font-medium transition-colors hover:border-line-strong"
          >
            <Plus className="size-4" />
            Add inbox
          </motion.button>
        )}
      </div>
    </header>
  );
}
