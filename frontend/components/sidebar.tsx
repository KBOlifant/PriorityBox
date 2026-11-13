"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Archive,
  Bookmark,
  Calendar,
  Clock,
  Inbox,
  LogOut,
  Mail,
  Plus,
} from "lucide-react";
import { LogoMark } from "./logo";
import { useAuth, useProfile } from "@/lib/auth";
import { actions } from "@/lib/store";
import { useCounts } from "@/lib/selectors";
import type { PageKey } from "@/lib/types";

const NAV: {
  key: PageKey;
  href: string;
  label: string;
  icon: typeof Inbox;
}[] = [
  { key: "priority", href: "/", label: "Priority inbox", icon: Inbox },
  { key: "all", href: "/all-mail", label: "All mail", icon: Mail },
  { key: "waiting", href: "/waiting", label: "Waiting", icon: Clock },
  { key: "events", href: "/events", label: "Events", icon: Calendar },
  { key: "archive", href: "/archive", label: "Archive", icon: Archive },
  { key: "saved", href: "/saved", label: "Saved", icon: Bookmark },
];

const LABELS = [
  { name: "Action needed", dot: "bg-[#C21E29]" },
  { name: "Waiting", dot: "bg-[#e5b45f]" },
  { name: "Event", dot: "bg-[#6fa08a]" },
];

export function Sidebar() {
  const pathname = usePathname();
  const counts = useCounts();
  const profile = useProfile();
  const { signOut } = useAuth();

  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line bg-sidebar md:flex">
      <div className="flex h-[72px] items-center gap-3 px-6">
        <LogoMark />
        <span className="text-[15px] font-semibold tracking-tight">
          Priority
        </span>
      </div>

      <nav className="mt-4 px-3" aria-label="Workspace">
        <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          Workspace
        </p>
        <ul className="space-y-1">
          {NAV.map(({ key, href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] transition-colors ${
                    active
                      ? "text-accent-text"
                      : "text-body hover:bg-white/[0.03] hover:text-ink"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl border border-accent-line/60 bg-accent-soft"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <Icon className="relative size-[18px]" strokeWidth={1.7} />
                  <span className="relative flex-1 font-medium">{label}</span>
                  <span
                    className={`relative text-[12px] tabular-nums ${
                      active ? "text-accent-text" : "text-muted"
                    }`}
                  >
                    {counts[key]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-8 px-6">
        <p className="pb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          Labels
        </p>
        <ul className="space-y-[18px]">
          {LABELS.map((l) => (
            <li key={l.name} className="flex items-center gap-3 text-[13px] text-body">
              <span className={`size-2 rounded-full ${l.dot}`} />
              {l.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto space-y-4 p-4">
        <motion.button
          type="button"
          onClick={actions.openConnect}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-[#38383d]"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-body">
            <Plus className="size-4" />
          </span>
          <span>
            <span className="block text-[13px] font-medium">Connect inbox</span>
            <span className="block text-[11px] text-muted">
              Gmail, Outlook &amp; more
            </span>
          </span>
        </motion.button>

        <div className="flex items-center gap-3 px-2 pb-1">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e9b7a3] text-[12px] font-semibold text-[#5a2a20]">
            {profile.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">
              {profile.name}
            </span>
            <span className="block truncate text-[11px] text-muted">
              {profile.email || "Local workspace"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            title="Sign out"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.05] hover:text-ink"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
