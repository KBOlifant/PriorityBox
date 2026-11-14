"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const KEY = "priority-theme";
const listeners = new Set<() => void>();

const read = (): Theme =>
  document.documentElement.dataset.theme === "light" ? "light" : "dark";

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

/** Flips between light and dark, remembering the choice on this device. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "dark" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode: the choice just won't persist */
    }
    listeners.forEach((l) => l());
  }

  const Icon = theme === "dark" ? Moon : Sun;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 font-medium">
        <Icon className="size-4 text-muted" strokeWidth={1.7} />
        {theme === "dark" ? "Dark mode" : "Light mode"}
      </span>
      <Switch on={theme === "dark"} label={`Switch to ${next} mode`} onClick={toggle} />
    </div>
  );
}

export function Switch({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-track"}`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}
