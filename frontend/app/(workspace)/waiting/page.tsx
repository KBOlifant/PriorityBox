"use client";

import { MessageGrid } from "@/components/message-grid";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { usePage } from "@/lib/selectors";

export default function WaitingPage() {
  const { all, visible, filtering } = usePage("waiting");

  return (
    <>
      <PageHeader
        highlight={`${all.length} open threads`}
        title="Waiting"
        subtitle="Conversations that need a reply, decision, or gentle follow-up."
      />
      <section className="mt-10">
        <SectionHeading
          title="Awaiting progress"
          meta={`${visible.length} messages`}
        />
        <div className="mt-4">
          <MessageGrid messages={visible} filtering={filtering} />
        </div>
      </section>
    </>
  );
}
