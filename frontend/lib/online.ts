import { useSyncExternalStore } from "react";

/** Why AI buttons are greyed out while there is no connection. */
export const AI_OFFLINE_HINT = "AI features need an internet connection.";

/** True unless the browser says it has no network. */
export const isOnline = () => typeof navigator === "undefined" || navigator.onLine !== false;

function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/** Re-renders when the connection drops or returns. Everything except the AI works without it. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
