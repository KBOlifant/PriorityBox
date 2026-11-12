"use client";

import { EventHighlights } from "@/components/event-highlights";
import { MessageGrid } from "@/components/message-grid";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { usePage } from "@/lib/selectors";

export default function EventsPage() {
  const { all, visible, filtering } = usePage("events");

  return (
    <>
      <PageHeader
        highlight={`${all.length} dated actions`}
        title="Events & action dates"
        subtitle="Deadlines, decisions, and calendar moments found in your email."
      />
      <div className="mt-8">
        <EventHighlights messages={visible} />
      </div>
      <section className="mt-10">
        <SectionHeading
          title="Upcoming dates"
          meta={`${visible.length} messages`}
        />
        <div className="mt-4">
          <MessageGrid messages={visible} filtering={filtering} />
        </div>
      </section>
    </>
  );
}
