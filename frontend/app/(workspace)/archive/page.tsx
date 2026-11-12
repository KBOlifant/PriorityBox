"use client";

import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { MessageGrid } from "@/components/message-grid";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { isToday, usePage } from "@/lib/selectors";

export default function ArchivePage() {
  const { all, visible, filtering } = usePage("archive");
  const [today, setToday] = useState(false);
  const shown = today ? visible.filter((m) => isToday(m.completedAt)) : visible;

  return (
    <>
      <PageHeader
        highlight={`${all.length} completed threads`}
        title="Archive"
        subtitle="Completed conversations kept nearby for context and reference."
      />
      <section className="mt-10">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <SectionHeading
              title="Archived conversations"
              meta={`${shown.length} messages`}
            />
          </div>
          <button
            type="button"
            aria-pressed={today}
            onClick={() => setToday((v) => !v)}
            className={`flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-medium transition-colors ${
              today
                ? "border-accent-line bg-accent-soft text-accent-text"
                : "border-line bg-surface text-body hover:border-[#38383d]"
            }`}
          >
            <CalendarCheck className="size-3.5" />
            Completed today
          </button>
        </div>
        <div className="mt-4">
          <MessageGrid messages={shown} filtering={filtering || today} />
        </div>
      </section>
    </>
  );
}
