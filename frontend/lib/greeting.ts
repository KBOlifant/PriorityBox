import { useSyncExternalStore } from "react";

/** "Good morning" before noon, "Good afternoon" until 5pm, "Good evening" after (and overnight). */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

// Checked every minute, so the greeting changes while the app stays open.
const subscribe = (onChange: () => void) => {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
};

/**
 * The greeting for the user's local time. The page is pre-rendered without a
 * clock, so the server render says "Hello" and the device's time takes over on load.
 */
export function useGreeting(): string {
  return useSyncExternalStore(
    subscribe,
    () => greetingFor(new Date().getHours()),
    () => "Hello",
  );
}
