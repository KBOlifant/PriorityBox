"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Check, ChevronDown, Settings } from "lucide-react";
import { Switch, ThemeToggle } from "./theme-toggle";
import { useAuth } from "@/lib/auth";
import { actions, useStore } from "@/lib/store";
import { clearMailCache, loadMailCache } from "@/services/mailCache";

const OPTIONS = [
  { hours: 0, label: "Don’t keep" },
  { hours: 1, label: "1 hour" },
  { hours: 6, label: "6 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 168, label: "7 days" },
];

/** Gear menu: how long emails stay on this device so they survive a refresh. */
export function SettingsMenu() {
  const { cacheHours } = useStore();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [cleared, setCleared] = useState(false);
  // Only read once on the client; the switch lives inside the closed-by-default panel, so SSR never renders it.
  const [notify, setNotify] = useState(() => {
    try {
      return localStorage.getItem("priority-notifications") === "on";
    } catch {
      return false;
    }
  });
  function toggleNotify() {
    const next = !notify;
    setNotify(next);
    try {
      localStorage.setItem("priority-notifications", next ? "on" : "off");
    } catch {}
  }
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function change(hours: number) {
    actions.setCacheHours(hours);
    // Turning it off, or shortening it, applies right away to what is already saved.
    if (user) loadMailCache(user.uid, hours);
  }

  function clearNow() {
    clearMailCache(user?.uid);
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center rounded-xl text-body transition-colors hover:bg-hover hover:text-ink"
      >
        <Settings className="size-[18px]" strokeWidth={1.7} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            role="dialog"
            aria-label="Settings"
            className="absolute right-0 top-full z-30 mt-2 w-[300px] rounded-xl border border-line bg-surface p-4 text-[13px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7)]"
          >
            <div className="space-y-3 border-b border-line pb-4">
              <ThemeToggle />
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-medium">
                  <Bell className="size-4 text-muted" strokeWidth={1.7} />
                  Notifications
                </span>
                <Switch on={notify} label="Notifications" onClick={toggleNotify} />
              </div>
            </div>
            <label htmlFor="cache-hours" className="mt-4 block font-medium">
              Keep emails on this device for
            </label>
            <div className="relative mt-2">
              <select
                id="cache-hours"
                value={cacheHours}
                onChange={(e) => change(Number(e.target.value))}
                className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-line bg-surface-2 pl-3 pr-9 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {/* A value from an older version that isn't in the list still shows. */}
                {!OPTIONS.some((o) => o.hours === cacheHours) && (
                  <option value={cacheHours}>{cacheHours} hours</option>
                )}
                {OPTIONS.map((o) => (
                  <option key={o.hours} value={o.hours}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-body" />
            </div>
            <p className="mt-2 text-[12px] leading-5 text-muted">
              A copy of your loaded emails is stored in this browser so they are still
              here after a refresh. It is never uploaded, and is removed when it
              expires, when you sign out, or when you clear it.
            </p>
            <button
              type="button"
              onClick={clearNow}
              className="mt-3 flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-[12.5px] text-body transition-colors hover:text-ink"
            >
              {cleared && <Check className="size-3.5" />}
              {cleared ? "Cleared" : "Clear saved emails now"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
