"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { syncMail } from "@/lib/mail";
import { actions, useStore } from "@/lib/store";

/** Loads the connected inboxes once the user is signed in. Renders nothing. */
export function MailSync() {
  const { user } = useAuth();
  const uid = user?.uid;

  useEffect(() => {
    if (uid) void syncMail(uid);
  }, [uid]);

  return null;
}

/** Slim notice above the page for sync progress and problems. */
export function MailBanner() {
  const { sync } = useStore();
  const stale = sync.accounts.filter((a) => a.status === "needs-reconnect");
  const analysing = sync.status === "classifying";
  const message = stale.length
    ? stale.map((a) => a.error).join(" ")
    : sync.status === "error" || sync.error
      ? sync.error
      : null;
  const show = Boolean(message) || analysing;

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key={message ?? "analysing"}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div
            role={message ? "alert" : "status"}
            className="mb-6 flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-body"
          >
            {message ? (
              <AlertCircle className="size-4 shrink-0 text-[#e5b45f]" />
            ) : (
              <Loader2 className="size-4 shrink-0 animate-spin text-accent-text" />
            )}
            <span className="flex-1">{message ?? "Analyzing your mail…"}</span>
            {stale.length > 0 && (
              <button
                type="button"
                onClick={actions.openConnect}
                className="shrink-0 font-medium text-accent-text hover:underline"
              >
                Reconnect
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
