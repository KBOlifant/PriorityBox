"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FolderPlus, X } from "lucide-react";
import { SaveToFolder } from "./save-to-folder";
import { actions, useStore } from "@/lib/store";
import type { Priority } from "@/lib/types";

const PRIORITIES: Priority[] = ["High", "Medium", "Low"];

/** Floating actions for the emails the user ticked: group into a folder, set priority, clear. */
export function SelectionBar() {
  const { selected, messages } = useStore();
  const pathname = usePathname();
  const [grouping, setGrouping] = useState(false);
  const [round, setRound] = useState(0);

  // A selection belongs to the screen it was made on.
  useEffect(() => {
    actions.clearSelected();
  }, [pathname]);

  useEffect(() => {
    if (!selected.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]")) actions.clearSelected();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected.length]);

  const picked = messages.filter((m) => selected.includes(m.id));

  function clear() {
    actions.clearSelected();
    setGrouping(false);
  }

  return (
    <AnimatePresence>
      {selected.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 md:pl-[248px]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            role="toolbar"
            aria-label="Selected emails"
            className="pointer-events-auto w-full max-w-[720px] rounded-2xl border border-line bg-raised p-2.5 text-[13px] shadow-[0_24px_60px_-16px_rgba(0,0,0,0.75)]"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 font-semibold text-ink">{selected.length} selected</span>
              <span className="mx-1 h-5 w-px bg-line" aria-hidden />
              <span className="text-[12px] text-muted">Priority</span>
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => actions.setPriorities(Object.fromEntries(picked.map((m) => [m.id, p])))}
                  className="h-8 rounded-lg border border-line px-2.5 text-[12.5px] font-medium text-body transition-colors hover:border-line-strong hover:text-ink"
                >
                  {p}
                </button>
              ))}
              <span className="mx-1 h-5 w-px bg-line" aria-hidden />
              <button
                type="button"
                onClick={() => {
                  setGrouping((g) => !g);
                  setRound((r) => r + 1);
                }}
                aria-expanded={grouping}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold transition-colors ${
                  grouping ? "bg-accent-soft text-accent-text" : "bg-accent text-white hover:bg-accent-hover"
                }`}
              >
                <FolderPlus className="size-4" />
                Group into folder
              </button>
              <button
                type="button"
                onClick={clear}
                aria-label="Clear selection"
                title="Clear selection (Esc)"
                className="ml-auto grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            {grouping && (
              <div className="mt-2.5 border-t border-line px-1 pt-2.5">
                <SaveToFolder
                  key={round}
                  messages={picked}
                  defaultName=""
                  compact
                  // Leave the confirmation on screen for a moment, then finish.
                  onSaved={() => setTimeout(clear, 2500)}
                />
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
