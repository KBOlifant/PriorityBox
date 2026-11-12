export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[10px] bg-gradient-to-b from-[#d0614f] to-[#b44f42] shadow-[0_4px_14px_-2px_rgba(192,88,74,0.5)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 16 16"
        fill="none"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13 8.2V11a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 11V5.5A2.5 2.5 0 0 1 5 3h3.2" />
        <circle cx="12.4" cy="3.6" r="1.1" fill="white" stroke="none" />
      </svg>
    </span>
  );
}
