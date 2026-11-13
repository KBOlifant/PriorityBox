"use client";

import { TODAY_LABEL } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { PriorityFilter } from "./priority-filter";

const todayLabel = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

export function PageHeader({
  highlight,
  title,
  subtitle,
}: {
  highlight: string;
  title: string;
  subtitle: string;
}) {
  const { usingSample } = useStore();

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
      <div>
        <p className="flex items-center gap-2 text-[12.5px] text-muted">
          {usingSample ? TODAY_LABEL : todayLabel()}
          <span className="size-[3px] rounded-full bg-muted" />
          <span className="text-accent-text">{highlight}</span>
        </p>
        <h1 className="mt-5 text-[38px] font-semibold leading-none tracking-[-0.035em]">
          {title}
        </h1>
        <p className="mt-5 text-[14.5px] text-body">{subtitle}</p>
      </div>
      <div className="pb-1">
        <PriorityFilter />
      </div>
    </header>
  );
}

export function SectionHeading({
  title,
  meta,
  count,
  icon,
}: {
  title: string;
  meta?: string;
  count?: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <h2 className="text-[14.5px] font-semibold">{title}</h2>
      {count !== undefined && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent-soft px-1.5 text-[11px] font-medium text-accent-text">
          {count}
        </span>
      )}
      {meta && <span className="text-[11.5px] text-muted">{meta}</span>}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
