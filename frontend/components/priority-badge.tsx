import type { Priority } from "@/lib/types";

const STYLES: Record<Priority, { label: string; dot: string }> = {
  High: { label: "Action needed", dot: "bg-[#C21E29]" },
  Medium: { label: "Waiting", dot: "bg-[#e5b45f]" },
  Low: { label: "Event", dot: "bg-[#6fa08a]" },
};

/** Classes a card adds to leave room (32px lip + 12px gutter) for the priority lip. */
export const PRIORITY_LIP_PAD = "pr-11";

const LIP_COLOR: Record<Priority, string> = {
  High: "bg-[#C21E29]",
  Medium: "bg-[#e5b45f]",
  Low: "bg-[#6fa08a]",
};

/** A 32px coloured lip down the right-hand side of a card, matching the badge dot. */
export function PriorityLip({ priority }: { priority: Priority }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 right-0 w-4 rounded-r-xl ${LIP_COLOR[priority]}`}
    />
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const s = STYLES[priority];
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1.5 text-[14px] font-medium text-body rounded-full p-2 `}>
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
