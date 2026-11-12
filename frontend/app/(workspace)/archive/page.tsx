"use client";

import { MessageGrid } from "@/components/message-grid";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { usePage } from "@/lib/selectors";

export default function ArchivePage() {
  const { all, visible, filtering } = usePage("archive");

  return (
    <>
      <PageHeader
        highlight={`${all.length} completed threads`}
        title="Archive"
        subtitle="Completed conversations kept nearby for context and reference."
      />
      <section className="mt-10">
        <SectionHeading
          title="Archived conversations"
          meta={`${visible.length} messages`}
        />
        <div className="mt-4">
          <MessageGrid messages={visible} filtering={filtering} />
        </div>
      </section>
    </>
  );
}
