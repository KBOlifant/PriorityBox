import type { Priority } from "@/lib/types";

const STYLES: Record<Priority, { wrap: string; dot: string }> = {
  High: {
    wrap: "border-[#5a2a25] bg-[#2d1613] text-[#f0806c]",
    dot: "bg-[#e8604c]",
  },
  Medium: {
    wrap: "border-[#50401f] bg-[#2b2313] text-[#e5b45f]",
    dot: "bg-[#e5b45f]",
  },
  Low: {
    wrap: "border-[#2f3a35] bg-[#1c2220] text-[#a9bdb2]",
    dot: "bg-[#7f9e8f]",
  },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const s = STYLES[priority];
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium ${s.wrap}`}
    >
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {priority}
    </span>
  );
}
