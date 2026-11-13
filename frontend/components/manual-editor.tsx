"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { addManualEntry, editManualEntry, type ManualInput } from "@/lib/manual";
import { editSavedEntry } from "@/lib/saved";
import { isOnline, useOnline } from "@/lib/online";
import { actions, useStore } from "@/lib/store";

const EMPTY: ManualInput = { activity: "", eventDate: "", progressNote: "", remarks: "" };

const field =
  "w-full rounded-xl border border-line bg-surface px-3.5 text-[14px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent-line focus:ring-2 focus:ring-accent/20";

/**
 * Mounts the form while the store says it is open. It edits a manual entry, a
 * saved email (same fields), or creates a new manual entry.
 */
export function ManualEditor() {
  const { manualEditor, manual, saved } = useStore();
  const id = manualEditor?.id;
  const savedItem = id && manualEditor?.saved ? saved.find((s) => s.id === id && !s.removed) : undefined;
  const manualItem = id && !manualEditor?.saved ? manual.find((e) => e.id === id) : undefined;
  const target = savedItem ?? manualItem;
  // Asked to edit something that no longer exists: show nothing.
  const open = !!manualEditor && (!id || !!target);

  return (
    <AnimatePresence>
      {open && (
        // Keyed so switching between "new" and an entry resets the form.
        <EditorDialog
          key={`${manualEditor?.saved ? "saved" : "manual"}:${id ?? "new"}`}
          entryId={target?.id}
          isSaved={!!savedItem}
          context={savedItem ? `${savedItem.sender}: ${savedItem.subject}` : undefined}
          initial={target ?? EMPTY}
        />
      )}
    </AnimatePresence>
  );
}

function EditorDialog({
  entryId,
  initial,
  isSaved = false,
  context,
}: {
  entryId?: string;
  initial: ManualInput;
  /** Editing a saved email rather than a manual entry. */
  isSaved?: boolean;
  /** The original email this saved item points at, shown for reference. */
  context?: string;
}) {
  const { user } = useAuth();
  const online = useOnline();
  const [form, setForm] = useState<ManualInput>({
    activity: initial.activity,
    eventDate: initial.eventDate,
    progressNote: initial.progressNote,
    remarks: initial.remarks,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const titleId = useId();

  const close = () => actions.closeManualEditor();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) actions.closeManualEditor();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [busy]);

  const set = (k: keyof ManualInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !user) return;
    const input: ManualInput = {
      activity: form.activity.trim(),
      eventDate: form.eventDate,
      progressNote: form.progressNote.trim(),
      remarks: form.remarks.trim(),
    };
    if (!input.activity) {
      setError("Describe what the email is about.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { rated } = entryId
        ? isSaved
          ? await editSavedEntry(user.uid, entryId, input)
          : await editManualEntry(user.uid, entryId, input)
        : await addManualEntry(user.uid, input);
      if (rated) return close();
      // Saved, but the AI could not set the meter: say so instead of closing silently.
      setNotice(
        isOnline()
          ? "Saved. The AI couldn’t rate the progress just now. Edit the entry later to try again."
          : "Saved on this device. You’re offline, so the AI will only rate the progress when you edit this entry once you’re back online.",
      );
    } catch {
      setError("Couldn’t save this entry. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        noValidate
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="w-full max-w-[560px] rounded-2xl border border-line bg-[#171719] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]"
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[16px] font-semibold">
              {isSaved ? "Edit saved email" : entryId ? "Edit entry" : "New entry"}
            </h2>
            {context && (
              <p className="mt-0.5 truncate text-[12px] text-muted" title={context}>
                {context}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.05] hover:text-ink disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-5 px-6 py-5">
          <div>
            <label htmlFor="m-activity" className="mb-1.5 block text-[13px] font-medium">
              Activity
            </label>
            <p className="mb-2 text-[12px] text-muted">What is the email about?</p>
            <input
              id="m-activity"
              autoFocus
              value={form.activity}
              onChange={set("activity")}
              maxLength={200}
              placeholder="e.g. Approve the Q3 launch budget"
              className={`${field} h-11`}
            />
          </div>

          <div>
            <label htmlFor="m-date" className="mb-1.5 block text-[13px] font-medium">
              Date of event <span className="font-normal text-muted">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="m-date"
                type="date"
                value={form.eventDate}
                onChange={set("eventDate")}
                className={`${field} h-11 max-w-[220px]`}
              />
              {form.eventDate && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, eventDate: "" }))}
                  className="text-[12.5px] text-muted hover:text-ink"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="m-progress" className="mb-1.5 block text-[13px] font-medium">
              Progress
            </label>
            <p className="mb-2 flex items-center gap-1.5 text-[12px] text-muted">
              <Sparkles className="size-3 text-accent-text" />
              {online
                ? "Describe how it is going. The AI sets the progress meter from this."
                : "Describe how it is going. You’re offline, so the AI can’t set the meter until you’re back online."}
            </p>
            <textarea
              id="m-progress"
              value={form.progressNote}
              onChange={set("progressNote")}
              maxLength={500}
              rows={3}
              placeholder="e.g. Draft is written, waiting for finance to confirm the numbers"
              className={`${field} resize-none py-3 leading-6`}
            />
          </div>

          <div>
            <label htmlFor="m-remarks" className="mb-1.5 block text-[13px] font-medium">
              Remarks
            </label>
            <textarea
              id="m-remarks"
              value={form.remarks}
              onChange={set("remarks")}
              maxLength={1000}
              rows={3}
              placeholder="Notes for yourself"
              className={`${field} resize-none py-3 leading-6`}
            />
          </div>

          {error && (
            <p role="alert" className="text-[13px] text-[#f0a090]">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-[13px] text-[#e5b45f]">
              {notice}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
          {notice ? (
            <button
              type="button"
              onClick={close}
              className="h-10 rounded-xl bg-accent px-5 text-[13.5px] font-semibold text-white hover:bg-accent-hover"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="h-10 rounded-xl px-4 text-[13.5px] text-body hover:text-ink disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex h-10 items-center gap-2 rounded-xl bg-accent px-5 text-[13.5px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-70"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {busy ? "Rating progress…" : entryId ? "Save changes" : "Save entry"}
              </button>
            </>
          )}
        </footer>
      </motion.form>
    </motion.div>,
    document.body,
  );
}
