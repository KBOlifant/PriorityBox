"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const TONES = {
  /** Quiet icon button. */
  neutral: "text-muted hover:bg-white/[0.04] hover:text-ink",
  /** Primary action. */
  accent: "bg-accent text-accent-text hover:bg-accent-hover",
  /** Marks something important. */
  alert:
    "border border-alert-line bg-alert-soft text-alert-text hover:border-alert/70",
};

interface Common {
  icon: React.ReactNode;
  /** Shown when hovered or focused, and always used as the accessible name. */
  label: string;
  tone?: keyof typeof TONES;
  className?: string;
}
interface AsButton extends Common {
  onClick: () => void;
  href?: undefined;
  external?: undefined;
}
interface AsLink extends Common {
  href: string;
  /** Opens in a new tab. */
  external?: boolean;
  onClick?: undefined;
}

/**
 * An icon-only button that slides its text label out on hover or keyboard focus.
 * Renders a link when given `href`, otherwise a button.
 */
export function RevealButton(props: AsButton | AsLink) {
  const { icon, label, tone = "neutral", className = "" } = props;
  const [show, setShow] = useState(false);

  const shared = {
    onHoverStart: () => setShow(true),
    onHoverEnd: () => setShow(false),
    onFocus: () => setShow(true),
    onBlur: () => setShow(false),
    whileTap: { scale: 0.96 },
    "aria-label": label,
    className: `flex h-9 shrink-0 cursor-pointer items-center rounded-lg px-[0.6rem] text-[13px] font-medium transition-colors ${TONES[tone]} ${className}`,
  };

  const content = (
    <>
      {icon}
      <AnimatePresence initial={false}>
        {show && (
          <motion.span
            key="label"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden whitespace-nowrap"
          >
            <span className="block pl-2">{label}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </>
  );

  if (props.href !== undefined) {
    return (
      <motion.a
        {...shared}
        href={props.href}
        {...(props.external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {content}
      </motion.a>
    );
  }
  return (
    <motion.button {...shared} type="button" onClick={props.onClick}>
      {content}
    </motion.button>
  );
}
