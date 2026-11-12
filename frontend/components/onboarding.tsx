"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Link2, Mail } from "lucide-react";
import { LogoMark } from "./logo";
import { actions, useStore } from "@/lib/store";

const eyebrow =
  "text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-text";

export function Onboarding() {
  const { onboarding, onboarded } = useStore();

  useEffect(() => {
    if (!onboarding) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") actions.finishOnboarding();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onboarding]);

  return (
    <AnimatePresence>
      {onboarding && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-md"
        >
          <motion.div
            layout
            role="dialog"
            aria-modal="true"
            aria-label="Welcome to Priority"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="w-full max-w-[520px] overflow-hidden rounded-[28px] border border-line bg-[#171719] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center justify-between border-b border-line px-7 py-4">
              <div className="flex items-center gap-3">
                <LogoMark size={32} />
                <span className="text-[14px] font-semibold">Priority</span>
              </div>
              <span className="text-[12px] text-muted">
                Step {onboarding} of 2
              </span>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={onboarding}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.2 }}
                className="p-9 pt-8"
              >
                {onboarding === 1 ? (
                  <StepOne />
                ) : (
                  <StepTwo onboarded={onboarded} />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PrimaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      autoFocus
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[14px] font-semibold text-white transition-colors hover:bg-accent-hover"
    >
      {children}
      <ArrowRight className="size-4" />
    </motion.button>
  );
}

function StepOne() {
  const points = ["Rank messages", "Track progress", "Add context"];
  return (
    <>
      <span className="grid size-14 place-items-center rounded-2xl border border-accent-line bg-accent-soft text-accent-text">
        <Mail className="size-6" strokeWidth={1.6} />
      </span>
      <p className={`${eyebrow} mt-7`}>A calmer inbox</p>
      <h2 className="mt-3 text-[28px] font-semibold leading-[1.15] tracking-[-0.03em]">
        Focus on the messages that move work forward.
      </h2>
      <p className="mt-5 text-[14.5px] leading-7 text-body">
        Priority groups urgent emails, tracks next steps, and gives you concise
        AI-ready summaries without losing the original context.
      </p>
      <ol className="mt-7 grid grid-cols-3 gap-2.5">
        {points.map((p, i) => (
          <li
            key={p}
            className="rounded-xl border border-line bg-surface p-3 text-[12px] text-body"
          >
            <span className="mb-3 grid size-6 place-items-center rounded-full bg-surface-2 text-[10px] font-semibold text-ink">
              {i + 1}
            </span>
            {p}
          </li>
        ))}
      </ol>
      <div className="mt-8">
        <PrimaryButton onClick={actions.nextStep}>Continue</PrimaryButton>
      </div>
    </>
  );
}

function StepTwo({ onboarded }: { onboarded: boolean }) {
  const providers = [
    {
      letter: "G",
      name: "Connect Google Workspace",
      hint: "Available when live integrations are enabled",
      tile: "bg-[#a8aab0] text-[#3d4f8a]",
    },
    {
      letter: "M",
      name: "Connect Microsoft Outlook",
      hint: "Microsoft 365 and Outlook.com",
      tile: "bg-[#2a4a85] text-white",
    },
  ];

  return (
    <>
      <p className={eyebrow}>Choose how to begin</p>
      <h2 className="mt-3 text-[28px] font-semibold leading-[1.15] tracking-[-0.03em]">
        Bring your inbox, or explore first.
      </h2>
      <p className="mt-5 text-[14.5px] leading-7 text-body">
        Connections are not enabled yet. You can still explore every workflow
        with realistic sample messages.
      </p>
      <ul className="mt-6 space-y-3">
        {providers.map((p) => (
          <li key={p.name}>
            <button
              type="button"
              disabled
              className="flex w-full items-center gap-4 rounded-xl border border-line bg-surface p-4 text-left opacity-70"
            >
              <span
                className={`grid size-10 place-items-center rounded-lg text-[14px] font-bold ${p.tile}`}
              >
                {p.letter}
              </span>
              <span className="flex-1">
                <span className="block text-[14px] font-medium text-body">
                  {p.name}
                </span>
                <span className="block text-[11.5px] text-muted">{p.hint}</span>
              </span>
              <Link2 className="size-4 text-muted" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <PrimaryButton onClick={actions.finishOnboarding}>
          Explore with sample data
        </PrimaryButton>
      </div>
      <button
        type="button"
        onClick={actions.back}
        className="mx-auto mt-5 block text-[13px] text-muted transition-colors hover:text-ink"
      >
        {onboarded ? "Cancel" : "Back"}
      </button>
    </>
  );
}
