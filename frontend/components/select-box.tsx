"use client";

import { actions, useStore } from "@/lib/store";

/** The checkbox on the left of an email card, like Gmail's, for picking several emails. */
export function SelectBox({ id, label, className = "" }: { id: string; label: string; className?: string }) {
  const { selected } = useStore();
  const on = selected.includes(id);
  return (
    <label
      className={`grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg transition-colors hover:bg-hover ${className}`}
      title={on ? "Unselect" : "Select"}
    >
      <input
        type="checkbox"
        checked={on}
        onChange={() => actions.toggleSelected(id)}
        aria-label={`Select ${label}`}
        className="size-4 cursor-pointer accent-accent"
      />
    </label>
  );
}

/** True when this email's checkbox is ticked. */
export function useIsSelected(id: string) {
  return useStore().selected.includes(id);
}
