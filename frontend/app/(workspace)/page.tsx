"use client";

import { Flag } from "lucide-react";
import { MessageGrid } from "@/components/message-grid";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { useProfile } from "@/lib/auth";
import { needsAttention, usePage } from "@/lib/selectors";

export default function PriorityInboxPage() {
  const { firstName } = useProfile();
  const { all, visible, filtering } = usePage("priority");
  const attention = visible.filter(needsAttention);
  const rest = visible.filter((m) => !needsAttention(m));
  const attentionTotal = all.filter(needsAttention).length;

  return (
    <>
      <PageHeader
        highlight={`${attentionTotal} need attention`}
        title={`Good morning, ${firstName}.`}
        subtitle="Here’s what deserves your attention today."
      />

      {visible.length === 0 ? (
        <div className="mt-10">
          <MessageGrid messages={[]} filtering={filtering} />
        </div>
      ) : (
        <>
          {attention.length > 0 && (
            <section className="mt-10">
              <SectionHeading
                title="Needs attention"
                count={attention.length}
                icon={
                  <span className="grid size-8 place-items-center rounded-lg border border-accent-line bg-accent-soft text-accent-text">
                    <Flag className="size-3.5" />
                  </span>
                }
              />
              <div className="mt-4">
                <MessageGrid messages={attention} />
              </div>
            </section>
          )}
          {rest.length > 0 && (
            <section className="mt-10">
              <SectionHeading
                title="Everything else"
                meta={`${rest.length} messages`}
              />
              <div className="mt-4">
                <MessageGrid messages={rest} />
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
