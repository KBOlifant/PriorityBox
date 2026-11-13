"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { syncMail } from "@/lib/mail";
import { createEditSink, loadManual } from "@/lib/manual";
import { keepBody, loadSaved, missingAutoSaves, missingBodies, saveMessage } from "@/lib/saved";
import { actions, setEditSink, useStore } from "@/lib/store";
import { timeAgo } from "@/services/mailCache";

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
  const { sync, mode } = useStore();
  const stale = sync.accounts.filter((a) => a.status === "needs-reconnect");
  const analysing = sync.status === "classifying";
  const problem = stale.length
    ? stale.map((a) => a.error).join(" ")
    : sync.status === "error" || sync.error
      ? sync.error
      : null;
  // Until live mail loads we show the copy kept on this device; say so once it is clear that's all there is.
  const savedCopy =
    sync.cachedAt && sync.status !== "loading"
      ? `Showing the emails saved on this device from ${timeAgo(sync.cachedAt)}.`
      : null;
  const message = [problem, savedCopy].filter(Boolean).join(" ") || null;
  const show = mode === "mail" && (Boolean(message) || analysing);

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
              <AlertCircle className="size-4 shrink-0 text-warn" />
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

/** Shows the active AI search and lets the user clear it. */
export function AiFilterChip() {
  const { aiFilter } = useStore();
  const n = aiFilter?.ids.length ?? 0;

  return (
    <AnimatePresence initial={false}>
      {aiFilter && (
        <motion.div
          key="ai-filter"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-accent-line bg-accent-soft px-4 py-2.5 text-[13px]">
            <Sparkles className="size-4 shrink-0 text-accent-text" />
            <span className="min-w-0 flex-1 truncate text-body">
              AI search: “{aiFilter.query}” · {n} {n === 1 ? "match" : "matches"}
            </span>
            <button
              type="button"
              onClick={() => actions.setAiFilter(null)}
              className="shrink-0 font-medium text-accent-text hover:underline"
            >
              Clear
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Keeps the saved-for-later list in step: loads it on sign-in, and saves a
 * reference to every High priority email that isn't saved yet. Renders nothing.
 */
export function SavedSync() {
  const { user } = useAuth();
  const { messages, saved, savedLoaded } = useStore();
  const uid = user?.uid;
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    if (uid) void loadSaved(uid);
  }, [uid]);

  useEffect(() => {
    // Wait for the saved list so an email that is already saved isn't saved twice.
    if (!uid || !savedLoaded) return;
    const missing = missingAutoSaves(messages, saved).filter((m) => !inFlight.current.has(m.id));
    if (!missing.length) return;
    const timer = setTimeout(() => {
      for (const m of missing) {
        inFlight.current.add(m.id);
        void saveMessage(uid, m, true);
      }
    }, 800); // let priorities settle (AI analysis, re-marks) before saving
    return () => clearTimeout(timer);
  }, [uid, messages, saved, savedLoaded]);

  // Emails saved earlier get their text kept on this device too, whenever they are loaded.
  useEffect(() => {
    if (!uid) return;
    for (const m of missingBodies(uid, messages, saved)) keepBody(uid, m);
  }, [uid, messages, saved]);

  return null;
}

/** Loads the user's manual entries and lets cards save their own edits. Renders nothing. */
export function ManualSync() {
  const { user } = useAuth();
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return;
    void loadManual(uid);
    setEditSink(createEditSink(uid));
    return () => setEditSink(null);
  }, [uid]);

  return null;
}

/** Shown in manual mode while there is nothing yet. */
export function ManualHint() {
  const { mode, manual } = useStore();
  if (mode !== "manual" || manual.length > 0) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">Manual mode</p>
        <p className="mt-1 text-[12.5px] leading-5 text-muted">
          Add the emails you want to keep track of yourself: what each is about, any event date, how it is going,
          and your own remarks. The AI sets the progress meter.
        </p>
      </div>
      <button
        type="button"
        onClick={() => actions.openManualEditor()}
        className="h-10 shrink-0 rounded-xl bg-accent px-4 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        Add your first entry
      </button>
    </div>
  );
}
