"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, FolderOpen, Pencil, Sparkles, Trash2 } from "lucide-react";
import { FolderEmailCard } from "@/components/folder-email-card";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { deleteFolder, loadFolderItems, renameFolder } from "@/lib/folders";
import { useStore } from "@/lib/store";
import type { FolderRef } from "@/services/firestore/folders";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * "Grouped Emails": folders saved from AI results. The folder is chosen with
 * ?folder=<id> rather than a /grouped/[id] route, because the desktop build is a
 * static export and can't know folder ids ahead of time.
 */
export default function GroupedPage() {
  // useSearchParams needs a Suspense boundary in a static build.
  return (
    <Suspense fallback={null}>
      <Grouped />
    </Suspense>
  );
}

function Grouped() {
  const folderId = useSearchParams().get("folder");
  return folderId ? <FolderView folderId={folderId} /> : <FolderList />;
}

function FolderList() {
  const { folders, foldersLoaded, query } = useStore();
  const q = query.trim().toLowerCase();
  const visible = folders.filter((f) => !q || `${f.name} ${f.instruction}`.toLowerCase().includes(q));

  return (
    <>
      <PageHeader
        highlight={plural(folders.length, "folder")}
        title="Grouped Emails"
        subtitle="Groups of emails saved from the AI bar. Only references are stored; emails open from your inbox."
      />
      <section className="mt-10">
        <SectionHeading title="Folders" meta={plural(visible.length, "folder")} />
        <div className="mt-4">
          {visible.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid place-items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center"
            >
              <FolderOpen className="size-6 text-muted" strokeWidth={1.5} />
              <p className="mt-3 text-[14px] font-medium">
                {folders.length ? "No folders match" : foldersLoaded ? "No folders yet" : "Loading folders…"}
              </p>
              {!folders.length && foldersLoaded && (
                <p className="mt-1 flex max-w-sm items-center gap-1.5 text-[12.5px] text-muted">
                  <Sparkles className="size-3.5 shrink-0 text-accent-text" />
                  Ask the AI to group emails, e.g. “group my invoices”, then save the result as a folder.
                </p>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <AnimatePresence mode="popLayout" initial>
                {visible.map((f, i) => (
                  <FolderTile key={f.id} folder={f} index={i} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function FolderTile({ folder: f, index }: { folder: FolderRef; index: number }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(f.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  function saveName() {
    setEditing(false);
    if (user && name.trim() && name.trim() !== f.name) void renameFolder(user.uid, f.id, name);
    else setName(f.name);
  }

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 6) * 0.04 }}
      className="group relative min-w-0 rounded-xl bg-surface p-4 shadow-sm shadow-black/10 transition-shadow hover:shadow-md hover:shadow-black/15"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-accent-line bg-accent-soft text-accent-text">
          <FolderOpen className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveName();
              }}
              className="flex items-center gap-1.5"
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                maxLength={60}
                aria-label="Folder name"
                className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 text-[14px] text-ink outline-none focus:border-accent-text/60"
              />
              <button type="submit" aria-label="Save name" className="grid size-8 place-items-center rounded-lg text-accent-text">
                <Check className="size-4" />
              </button>
            </form>
          ) : (
            <Link
              href={`/grouped?folder=${f.id}`}
              className="block truncate text-[15px] font-semibold text-ink outline-none after:absolute after:inset-0 hover:text-accent-text focus-visible:underline"
            >
              {f.name}
            </Link>
          )}
          <p className="mt-0.5 text-[12.5px] text-muted">
            {plural(f.count, "email")}
            {f.created ? ` · ${new Date(f.created).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
          </p>
          {f.instruction && (
            <p className="mt-2 line-clamp-2 text-[12.5px] leading-5 text-body" title={f.instruction}>
              <Sparkles className="mr-1 inline size-3 -translate-y-px text-accent-text" />
              {f.instruction}
            </p>
          )}
        </div>
      </div>

      {/* Above the card-wide link so the buttons stay clickable. */}
      <div className="absolute right-2 top-2 z-10 flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Rename ${f.name}`}
          title="Rename"
          className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true);
            if (user) void deleteFolder(user.uid, f.id);
          }}
          aria-label={confirmDelete ? `Click again to delete ${f.name}` : `Delete ${f.name}`}
          title={confirmDelete ? "Click again to delete" : "Delete folder"}
          className={`grid h-8 place-items-center rounded-lg px-2 text-[12px] font-medium transition-colors ${
            confirmDelete ? "bg-alert-soft text-alert-text" : "text-muted hover:bg-hover hover:text-ink"
          }`}
        >
          {confirmDelete ? "Delete?" : <Trash2 className="size-3.5" />}
        </button>
      </div>
    </motion.article>
  );
}

function FolderView({ folderId }: { folderId: string }) {
  const { user } = useAuth();
  const { folders, foldersLoaded, folderItems, query } = useStore();
  const folder = folders.find((f) => f.id === folderId);
  const items = folderItems[folderId];
  const uid = user?.uid;

  useEffect(() => {
    if (uid) void loadFolderItems(uid, folderId);
  }, [uid, folderId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((i) => !q || `${i.sender} ${i.subject}`.toLowerCase().includes(q));
  }, [items, query]);

  if (!folder) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
        <p className="text-[14px] font-medium">{foldersLoaded ? "This folder doesn’t exist anymore" : "Loading…"}</p>
        <Link href="/grouped" className="mt-3 text-[13px] font-medium text-accent-text hover:underline">
          Back to Grouped Emails
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link
        href="/grouped"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        All folders
      </Link>
      <PageHeader
        highlight={plural(items?.length ?? folder.count, "email")}
        title={folder.name}
        subtitle={folder.instruction ? `Grouped by the AI from “${folder.instruction}”` : "A folder of grouped emails."}
      />
      <section className="mt-10">
        <SectionHeading title="Emails" meta={plural(visible.length, "email")} />
        <div className="mt-4">
          {!items ? (
            <p className="text-[13px] text-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
              <FolderOpen className="size-6 text-muted" strokeWidth={1.5} />
              <p className="mt-3 text-[14px] font-medium">{items.length ? "No emails match" : "This folder is empty"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-3">
              <AnimatePresence mode="popLayout" initial>
                {visible.map((item, i) => (
                  <FolderEmailCard key={item.id} item={item} folderId={folderId} index={i} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
