import type { Priority } from "@/lib/types";

const STYLES: Record<Priority, { label: string; dot: string }> = {
  High: { label: "Action needed", dot: "bg-[#C21E29]" },
  Medium: { label: "Waiting", dot: "bg-[#e5b45f]" },
  Low: { label: "Event", dot: "bg-[#6fa08a]" },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const s = STYLES[priority];
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1.5 text-[14px] font-medium text-body rounded-full p-2 `}>
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
