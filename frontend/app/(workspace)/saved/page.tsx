"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark } from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { SavedCard } from "@/components/saved-card";
import { useStore } from "@/lib/store";

export default function SavedPage() {
  const { saved, filter, query } = useStore();

  const { all, visible } = useMemo(() => {
    const all = saved.filter((s) => !s.removed).sort((a, b) => b.savedAt - a.savedAt);
    const q = query.trim().toLowerCase();
    const visible = all.filter(
      (s) =>
        (filter === "All" || s.priority === filter) &&
        (!q || `${s.sender} ${s.subject}`.toLowerCase().includes(q)),
    );
    return { all, visible };
  }, [saved, filter, query]);

  return (
    <>
      <PageHeader
        highlight={`${all.length} saved`}
        title="Saved for later"
        subtitle="Emails you want to come back to. Only a reference is kept, never the email itself."
      />
      <section className="mt-10">
        <SectionHeading title="Saved emails" meta={`${visible.length} items`} />
        <div className="mt-4">
          {visible.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid place-items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center"
            >
              <Bookmark className="size-6 text-muted" strokeWidth={1.5} />
              <p className="mt-3 text-[14px] font-medium">
                {all.length ? "No saved emails match" : "Nothing saved yet"}
              </p>
              <p className="mt-1 max-w-sm text-[12.5px] text-muted">
                {all.length
                  ? "Try a different search or priority filter."
                  : "High priority emails are saved automatically, or use the bookmark on any email."}
              </p>
            </motion.div>
          ) : (
            <div className="grid items-stretch gap-3 lg:grid-cols-2">
              <AnimatePresence mode="popLayout" initial>
                {visible.map((s, i) => (
                  <SavedCard key={s.id} item={s} index={i} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
