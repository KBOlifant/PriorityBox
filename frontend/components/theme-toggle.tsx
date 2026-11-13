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

  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={toggle}
      className="grid size-10 place-items-center rounded-xl text-body transition-colors hover:bg-hover hover:text-ink"
    >
      <Icon className="size-[18px]" strokeWidth={1.7} />
    </button>
  );
}
