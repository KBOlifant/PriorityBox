import { formatEventDate } from "@/services/mail/classifyParse";
import type { Classification, RawMail } from "@/services/mail/types";
import type { Message } from "./types";

const COLORS = [
  "#c25b4c", "#8b6558", "#6f8466", "#6b5d8c",
  "#44687a", "#7a6048", "#4f7a72", "#5a6585",
];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function initials(name: string, email: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1
    ? words[0][0] + words[words.length - 1][0]
    : (words[0] ?? email).slice(0, 2);
  return letters.toUpperCase();
}

function when(ms: number) {
  const d = new Date(ms);
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dayStart(new Date()) - dayStart(d)) / 86_400_000);
  return {
    day:
      diff === 0
        ? "Today"
        : diff === 1
          ? "Yesterday"
          : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

function preview(body: string, subject: string) {
  const flat = body.replace(/\s+/g, " ").trim();
  if (!flat) return subject;
  return flat.length > 220 ? flat.slice(0, 220).trimEnd() + "…" : flat;
}

/** Real mail -> the app's Message. `c` is missing until the AI analysis finishes. */
export function toMessage(m: RawMail, c?: Classification): Message {
  return {
    id: m.id,
    sender: m.fromName,
    email: m.fromEmail,
    initials: initials(m.fromName, m.fromEmail),
    avatarColor: COLORS[hash(m.fromEmail || m.fromName) % COLORS.length],
    ...when(m.receivedAt),
    subject: m.subject,
    preview: preview(m.body, m.subject),
    event: c?.event ? { label: c.event.label, date: formatEventDate(c.event.date) } : undefined,
    priority: c?.priority ?? "Medium",
    waiting: c?.waiting ?? false,
    archived: false,
    progress: c
      ? { stage: c.stage, percent: c.percent }
      : { stage: "Analyzing…", percent: 0 },
    tags: c?.tags ?? [],
    remarks: "",
    body: m.body,
    provider: m.provider,
    webLink: m.webLink,
  };
}
