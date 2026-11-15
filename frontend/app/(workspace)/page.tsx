"use client";

import Image from "next/image";
import { Flag } from "lucide-react";
import headerImage from "@/assets/HomePageHeader_PriorityBox.webp";
import { useGreeting } from "@/lib/greeting";
import { AiBar } from "@/components/ai-bar";
import { AiResults } from "@/components/ai-results";
import { MessageGrid } from "@/components/message-grid";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { useProfile } from "@/lib/auth";
import { needsAttention, useAiResults, usePage } from "@/lib/selectors";

export default function PriorityInboxPage() {
  const { firstName } = useProfile();
  const greeting = useGreeting();
  const { all, visible, filtering } = usePage("priority");
  const results = useAiResults();
  const attention = visible.filter(needsAttention);
  const rest = visible.filter((m) => !needsAttention(m));
  const attentionTotal = all.filter(needsAttention).length;

  return (
    <>
      {/* Header image, faded into the page at the bottom; the greeting sits on the faded part. */}
      <div className="relative -mt-4">
        <div className="relative h-72 overflow-hidden rounded-2xl" aria-hidden>
          <Image
            src={headerImage}
            alt=""
            fill
            priority
            sizes="(min-width: 1200px) 1160px, 100vw"
            className="object-cover object-[50%_40%]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-canvas/0 via-canvas/55 via-55% to-canvas" />
        </div>
        <div className="relative -mt-36 px-6">
          <PageHeader
            highlight={`${attentionTotal} need attention`}
            title={`${greeting}, ${firstName}.`}
            subtitle="Here’s what deserves your attention today."
          />
        </div>
      </div>

      <div className="mt-8">
        <AiBar />
      </div>

      {/* An AI result replaces the inbox until the user goes back to it. */}
      {results ? (
        <AiResults {...results} />
      ) : visible.length === 0 ? (
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
                tone="alert"
                icon={
                  <span className="grid size-8 place-items-center rounded-lg border border-alert-line bg-alert-soft text-alert-text">
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
