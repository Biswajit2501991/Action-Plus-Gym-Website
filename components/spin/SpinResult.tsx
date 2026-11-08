"use client";

import { useState } from "react";

export function SpinResult({
  discount,
  couponCode,
  expiresAt,
  alreadyUsed,
}: {
  discount: number;
  couponCode: string | null;
  expiresAt: string | null;
  alreadyUsed?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const expiry = expiresAt
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(new Date(expiresAt))
    : "";

  return (
    <div className="rounded-2xl border border-[#eab308]/50 bg-black/40 px-4 py-3 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#eab308]">
        {alreadyUsed ? "Your prize" : "You won"}
      </p>
      <p className="mt-1 text-3xl font-extrabold text-white">{discount}% off</p>
      {couponCode ? (
        <>
          <p className="mt-2 font-mono text-lg font-bold tracking-wide text-white">{couponCode}</p>
          <button
            type="button"
            className="mt-2 rounded-full border border-[#eab308] px-3 py-1 text-xs font-semibold text-[#eab308]"
            onClick={() => {
              void navigator.clipboard?.writeText(couponCode).then(() => setCopied(true));
            }}
          >
            {copied ? "Copied" : "Copy code"}
          </button>
          <p className="mt-2 text-xs leading-relaxed text-white/75">
            Show this code at the desk{expiry ? ` before ${expiry}` : ""}. It does not change a payment by itself.
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-white/70">This prize was already used.</p>
      )}
    </div>
  );
}
