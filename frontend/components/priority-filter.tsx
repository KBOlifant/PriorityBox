"use client";

import { motion } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import { actions, useStore } from "@/lib/store";
import type { Filter } from "@/lib/types";

const OPTIONS: Filter[] = ["All", "High", "Medium", "Low"];

export function PriorityFilter() {
  const { filter } = useStore();

  return (
    <div
      role="group"
      aria-label="Filter by priority"
      className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1"
    >
      {OPTIONS.map((o) => {
        const active = filter === o;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={active}
            onClick={() => actions.setFilter(o)}
            className={`relative h-8 rounded-lg px-3.5 text-[12px] font-medium transition-colors ${
              active ? "text-accent-text" : "text-muted hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId="filter-pill"
                className="absolute inset-0 rounded-lg bg-accent-soft"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o}</span>
          </button>
        );
      })}
      <button
        type="button"
        aria-label="More filters"
        className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:text-ink"
      >
        <SlidersHorizontal className="size-3.5" />
      </button>
    </div>
  );
}
