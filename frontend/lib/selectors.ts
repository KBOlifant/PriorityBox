import { useMemo } from "react";
import { useStore } from "./store";
import type { Filter, Message, PageKey } from "./types";

export const needsAttention = (m: Message) =>
  m.priority === "High" && !m.archived;

export const isToday = (ms?: number) =>
  ms !== undefined && new Date(ms).toDateString() === new Date().toDateString();

export function inPage(m: Message, page: PageKey): boolean {
  switch (page) {
    case "priority":
      return !m.archived;
    case "all":
      return true;
    case "waiting":
      return m.waiting && !m.archived;
    case "events":
      return !!m.event;
    case "archive":
      return m.archived;
    case "saved":
      return false; // saved items are references, not loaded messages
  }
}

function matchesQuery(m: Message, q: string) {
  if (!q) return true;
  const hay = `${m.sender} ${m.subject} ${m.preview}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

export function matchesFilter(m: Message, filter: Filter) {
  return filter === "All" || m.priority === filter;
}

/** Real mail belongs to a fetched page and only the viewed page is shown. Sample data has no pages. */
const onViewedPage = (m: Message, page: number) =>
  m.page === undefined || m.page === page;

/**
 * Messages for a screen. `all` is everything the screen could show (used for
 * its headline count); `visible` also applies the priority filter and search.
 * An AI search result replaces paging: it shows matches from every loaded page.
 */
export function usePage(screen: PageKey) {
  const { messages, filter, query, aiFilter, sync } = useStore();
  return useMemo(() => {
    const ids = aiFilter ? new Set(aiFilter.ids) : null;
    const inView = (m: Message) =>
      ids ? ids.has(m.id) : onViewedPage(m, sync.page);
    const all = messages.filter((m) => inView(m) && inPage(m, screen));
    const q = query.trim();
    const visible = all.filter(
      (m) => matchesFilter(m, filter) && matchesQuery(m, q),
    );
    return { all, visible, filtering: filter !== "All" || q !== "" || !!ids };
  }, [messages, filter, query, aiFilter, sync.page, screen]);
}

/** Sidebar counts for the page being viewed. */
export function useCounts() {
  const { messages, sync, saved } = useStore();
  return useMemo(() => {
    const view = messages.filter((m) => onViewedPage(m, sync.page));
    return {
      priority: view.filter(needsAttention).length,
      all: view.length,
      waiting: view.filter((m) => inPage(m, "waiting")).length,
      events: view.filter((m) => inPage(m, "events")).length,
      archive: view.filter((m) => inPage(m, "archive")).length,
      saved: saved.filter((s) => !s.removed).length,
    };
  }, [messages, sync.page, saved]);
}
