"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { addToFolder, createFolder, isFolderable } from "@/lib/folders";
import { useStore } from "@/lib/store";
import type { Message } from "@/lib/types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Saves emails into a new "Grouped Emails" folder or adds them to an existing
 * one. Used for an AI result and for emails the user ticked themselves.
 */
export function SaveToFolder({
  messages,
  defaultName,
  instruction = "",
  compact = false,
  onSaved,
}: {
  messages: Message[];
  defaultName: string;
  /** What produced the group (the AI instruction), shown on the folder; "" for a hand-made group. */
  instruction?: string;
  /** Tighter styling for the floating selection bar. */
  compact?: boolean;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const { folders } = useStore();
  const [name, setName] = useState(defaultName);
  const [target, setTarget] = useState("new");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ id: string; name: string; added: number } | null>(null);

  const emails = messages.filter(isFolderable);
  const skipped = messages.length - emails.length;

  if (!user) return null;
  if (!emails.length) {
    return (
      <p className="text-[12px] text-muted">
        Sample emails can’t be saved to folders. Connect an inbox to group your own mail.
      </p>
    );
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      if (target === "new") {
        const id = await createFolder(user.uid, name, instruction, emails);
        if (id) setSaved({ id, name: name.trim() || "Grouped emails", added: emails.length });
      } else {
        const added = await addToFolder(user.uid, target, emails);
        setSaved({ id: target, name: folders.find((f) => f.id === target)?.name ?? "folder", added });
      }
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <p className="text-[12.5px] text-body">
        {saved.added ? `Saved ${plural(saved.added, "email")} to` : "Already in"}{" "}
        <Link href={`/grouped?folder=${saved.id}`} className="font-medium text-accent-text hover:underline">
          {saved.name}
        </Link>
      </p>
    );
  }

  const field = "h-8";
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <FolderPlus className="size-4 shrink-0 text-accent-text" />
      {folders.length > 0 && (
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label="Folder"
          className={`${field} max-w-[9rem] rounded-lg border border-line bg-surface-2 px-2 text-[12.5px] text-body outline-none`}
        >
          <option value="new">New folder</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      )}
      {target === "new" && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Folder name"
          placeholder="Folder name"
          maxLength={60}
          className={`${field} min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 text-[12.5px] text-ink outline-none focus:border-accent-text/60 ${compact ? "w-40" : ""}`}
        />
      )}
      <button
        type="button"
        disabled={saving || (target === "new" && !name.trim())}
        onClick={() => void save()}
        className={`${field} shrink-0 rounded-lg bg-accent px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60`}
      >
        {saving ? "Saving…" : target === "new" ? "Save as folder" : "Add to folder"}
      </button>
      {skipped > 0 && (
        <span className="w-full text-[11.5px] text-muted">
          {plural(skipped, "sample email")} will be left out.
        </span>
      )}
    </div>
  );
}
