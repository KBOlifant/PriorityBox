"use client";

import { MessageGrid } from "@/components/message-grid";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { usePage } from "@/lib/selectors";

export default function AllMailPage() {
  const { all, visible, filtering } = usePage("all");

  return (
    <>
      <PageHeader
        highlight={`${all.length} conversations`}
        title="All mail"
        subtitle="Every message in your local workspace, in one focused view."
      />
      <section className="mt-10">
        <SectionHeading
          title="All conversations"
          meta={`${visible.length} messages`}
        />
        <div className="mt-4">
          <MessageGrid messages={visible} filtering={filtering} />
        </div>
      </section>
    </>
  );
}
