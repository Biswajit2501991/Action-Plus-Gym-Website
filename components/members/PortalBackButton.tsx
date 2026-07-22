"use client";

const BACK_CLASS =
  "inline-flex items-center gap-2 rounded-full border border-gold/50 bg-gold/15 px-4 py-2 text-sm font-semibold text-gold shadow-[0_0_0_1px_rgba(212,175,55,0.25)]";

/** Shared portal Back control — same look on every section. */
export function PortalBackButton({
  onClick,
  label = "← Back",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button type="button" onClick={onClick} className={BACK_CLASS}>
      {label}
    </button>
  );
}

export const PORTAL_BACK_BUTTON_CLASS = BACK_CLASS;
