import { formatEventDate } from "@/services/mail/classifyParse";
import type { ManualEntry } from "@/services/firestore/manualEntries";
import { when } from "./mail-map";
import type { Message } from "./types";

/** A hand-entered item as the card the screens already know how to show. */
export function manualToMessage(e: ManualEntry): Message {
  return {
    id: `manual:${e.id}`,
    sender: "Manual entry",
    email: "",
    initials: "ME",
    avatarColor: "#44687a",
    ...when(e.createdMs || Date.now()),
    subject: e.activity,
    preview: e.progressNote || "No progress comment yet.",
    event: e.eventDate ? { label: "Event date", date: formatEventDate(e.eventDate) } : undefined,
    priority: e.priority,
    // Anything not finished is still waiting on something.
    waiting: e.percent < 100,
    archived: e.archived,
    completedAt: e.completedAt || undefined,
    progress: { stage: e.stage, percent: e.percent },
    tags: [],
    remarks: e.remarks,
    provider: "manual",
  };
}
