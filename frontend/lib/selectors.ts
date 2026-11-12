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

/** Messages for a page: `all` ignores search/filter (for counts), `visible` applies them. */
export function usePage(page: PageKey) {
  const { messages, filter, query } = useStore();
  return useMemo(() => {
    const all = messages.filter((m) => inPage(m, page));
    const q = query.trim();
    const visible = all.filter(
      (m) => matchesFilter(m, filter) && matchesQuery(m, q),
    );
    return { all, visible, filtering: filter !== "All" || q !== "" };
  }, [messages, filter, query, page]);
}

export function useCounts() {
  const { messages } = useStore();
  return useMemo(
    () => ({
      priority: messages.filter(needsAttention).length,
      all: messages.filter((m) => inPage(m, "all")).length,
      waiting: messages.filter((m) => inPage(m, "waiting")).length,
      events: messages.filter((m) => inPage(m, "events")).length,
      archive: messages.filter((m) => inPage(m, "archive")).length,
    }),
    [messages],
  );
}
