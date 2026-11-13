"use client";

import { motion } from "framer-motion";
import { actions, useStore, type Mode } from "@/lib/store";

const OPTIONS: { mode: Mode; label: string; hint: string }[] = [
  { mode: "mail", label: "Inbox", hint: "Your connected Gmail and Outlook" },
  { mode: "manual", label: "Manual", hint: "Type in emails yourself" },
];

/** Switches the workspace between connected mail and hand-entered emails. */
export function ModeSwitch() {
  const { mode } = useStore();

  return (
    <div
      role="group"
      aria-label="Workspace mode"
      className="flex shrink-0 items-center gap-1 rounded-xl border border-line bg-surface p-1"
    >
      {OPTIONS.map((o) => {
        const active = mode === o.mode;
        return (
          <button
            key={o.mode}
            type="button"
            aria-pressed={active}
            title={o.hint}
            onClick={() => actions.setMode(o.mode)}
            className={`relative h-8 rounded-lg px-3 text-[12px] font-medium transition-colors ${
              active ? "text-accent-text" : "text-muted hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId="mode-pill"
                className="absolute inset-0 rounded-lg bg-accent-soft"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
