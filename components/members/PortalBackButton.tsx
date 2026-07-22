"use client";

/**
 * Canonical member-portal Back control.
 * Dark pill + gold border/text — matches the Training section look everywhere.
 */
const BACK_CLASS = [
  "inline-flex items-center justify-center gap-2",
  "rounded-full",
  "border border-[#b49a4c]",
  "bg-[#242118]",
  "px-5 py-2",
  "text-sm font-medium text-[#b49a4c]",
  "shadow-[0_0_12px_rgba(180,154,76,0.28)]",
  "transition-colors",
  "hover:bg-[#2e2a1c] hover:border-[#c9ae5c] hover:text-[#c9ae5c]",
  "active:scale-[0.98]",
].join(" ");

/** Shared portal Back control — same look on every member section. */
export function PortalBackButton({
  onClick,
  label = "← Back",
  className = "",
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button type="button" onClick={onClick} className={`${BACK_CLASS} ${className}`.trim()}>
      {label}
    </button>
  );
}

export const PORTAL_BACK_BUTTON_CLASS = BACK_CLASS;
