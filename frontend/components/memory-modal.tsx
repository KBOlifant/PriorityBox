"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { addMemory, removeMemory, updateMemory } from "@/lib/memory";
import { actions, MAX_MEMORIES, MAX_MEMORY_CHARS, useStore } from "@/lib/store";

/** Settings -> Custom memory: notes the user writes for the AI to remember on every request. */
export function MemoryModal() {
  const { memoryOpen } = useStore();
  return <AnimatePresence>{memoryOpen && <MemoryDialog key="memory" />}</AnimatePresence>;
}

function MemoryDialog() {
  const { memories } = useStore();
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);
  const full = memories.length >= MAX_MEMORIES;
  const uid = user?.uid;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") actions.closeMemory();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function add() {
    if (!uid || !draft.trim() || full) return;
    addMemory(uid, draft);
    setDraft("");
  }

  function saveEdit() {
    if (!uid || !editing) return;
    if (editing.text.trim()) updateMemory(uid, editing.index, editing.text);
    else removeMemory(uid, editing.index);
    setEditing(null);
  }

  // Enter saves, Shift+Enter makes a new line.
  const onEnter = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      fn();
    }
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={actions.closeMemory}
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-title"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-[520px] flex-col rounded-2xl border border-line bg-raised shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]"
      >
        <header className="flex items-start gap-3 border-b border-line px-6 py-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-accent-line bg-accent-soft text-accent-text">
            <Brain className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="memory-title" className="text-[16px] font-semibold">
              Custom memory
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-body">
              Notes the AI keeps in mind every time it helps you: who matters, what you work on, how you like things.
            </p>
          </div>
          <button
            type="button"
            onClick={actions.closeMemory}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {memories.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-muted">
              Nothing saved yet. Add your first note below.
            </p>
          ) : (
            <ul className="space-y-2">
              {memories.map((m, i) => (
                <li
                  key={`${i}-${m}`}
                  className="group flex items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-[13px]"
                >
                  {editing?.index === i ? (
                    <>
                      <textarea
                        autoFocus
                        rows={2}
                        value={editing.text}
                        maxLength={MAX_MEMORY_CHARS}
                        onChange={(e) => setEditing({ index: i, text: e.target.value })}
                        onKeyDown={onEnter(saveEdit)}
                        aria-label="Edit note"
                        className="min-w-0 flex-1 resize-none rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent-text/60"
                      />
                      <button
                        type="button"
                        onClick={saveEdit}
                        aria-label="Save note"
                        className="grid size-8 shrink-0 place-items-center rounded-lg text-accent-text hover:bg-hover"
                      >
                        <Check className="size-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 whitespace-pre-line break-words leading-5 text-body">{m}</span>
                      <button
                        type="button"
                        onClick={() => setEditing({ index: i, text: m })}
                        aria-label={`Edit note: ${m}`}
                        className="grid size-7 shrink-0 place-items-center rounded-lg text-muted opacity-0 transition-opacity hover:bg-hover hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => uid && removeMemory(uid, i)}
                        aria-label={`Delete note: ${m}`}
                        className="grid size-7 shrink-0 place-items-center rounded-lg text-muted opacity-0 transition-opacity hover:bg-hover hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-line px-6 py-4">
          <div className="flex items-start gap-2">
            <textarea
              rows={2}
              value={draft}
              maxLength={MAX_MEMORY_CHARS}
              disabled={full || !uid}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onEnter(add)}
              placeholder={
                full
                  ? `You have ${MAX_MEMORIES} notes. Delete one to add another.`
                  : "e.g. My manager is Sarah Lee. Her emails are always urgent."
              }
              aria-label="New note"
              className="min-w-0 flex-1 resize-none rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none placeholder:text-muted focus:border-accent-text/60 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={add}
              disabled={full || !draft.trim() || !uid}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              <Plus className="size-4" />
              Save
            </button>
          </div>
          <p className="mt-2 flex justify-between gap-3 text-[11.5px] leading-5 text-muted">
            <span>
              Sent with every AI request, so keep notes short. Don’t add passwords or other secrets. Only you can change
              these; emails and the AI can’t.
            </span>
            <span className="shrink-0 tabular-nums">
              {memories.length}/{MAX_MEMORIES} · {draft.length}/{MAX_MEMORY_CHARS}
            </span>
          </p>
        </footer>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
