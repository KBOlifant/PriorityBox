"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { goToPage, PAGE_SIZE } from "@/lib/mail";
import { useStore } from "@/lib/store";

/** Moves through the inbox 25 messages at a time. Fetches the next batch on demand. */
export function Pagination() {
  const { usingSample, sync, aiFilter, messages, mode } = useStore();

  // Sample data has no pages, and an AI search shows matches from every page.
  if (mode === "manual" || usingSample || aiFilter) return null;
  if (sync.loadedPages <= 1 && !sync.hasMore) return null;

  const loading = sync.status === "loading";
  const canPrev = sync.page > 1;
  const canNext = sync.page < sync.loadedPages || sync.hasMore;
  const onPage = messages.filter((m) => m.page === sync.page).length;
  const from = (sync.page - 1) * PAGE_SIZE + 1;

  const button =
    "flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-medium text-body transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-body";

  return (
    <nav
      aria-label="Inbox pages"
      className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6"
    >
      <button
        type="button"
        className={button}
        disabled={!canPrev || loading}
        onClick={() => void goToPage(sync.page - 1)}
      >
        <ChevronLeft className="size-4" />
        Previous
      </button>

      <p className="flex items-center gap-2 text-[12.5px] text-muted" aria-live="polite">
        {loading && <Loader2 className="size-3.5 animate-spin" />}
        Page {sync.page}
        {onPage > 0 && (
          <span>
            · messages {from}–{from + onPage - 1}
          </span>
        )}
      </p>

      <button
        type="button"
        className={button}
        disabled={!canNext || loading}
        onClick={() => void goToPage(sync.page + 1)}
      >
        Next
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}
