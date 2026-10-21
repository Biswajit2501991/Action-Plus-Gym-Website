"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { socialQrTargets } from "@/lib/site/social-links";

export function SocialQrLinks({
  socials,
}: {
  socials?: Record<string, string> | null;
}) {
  const targets = socialQrTargets(socials);
  const targetKey = targets.map((item) => `${item.id}:${item.url}`).join("|");
  const [codes, setCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const items = socialQrTargets(socials);
    (async () => {
      const next: Record<string, string> = {};
      for (const item of items) {
        next[item.id] = await QRCode.toDataURL(item.url, {
          margin: 1,
          width: 280,
          errorCorrectionLevel: "M",
          color: { dark: "#111111", light: "#ffffff" },
        });
      }
      if (!cancelled) setCodes(next);
    })().catch(() => {
      if (!cancelled) setCodes({});
    });
    return () => {
      cancelled = true;
    };
  }, [socials, targetKey]);

  if (!targets.length) return null;

  return (
    <div className="flex flex-wrap gap-4">
      {targets.map((item) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="flex w-28 flex-col items-center gap-2 text-center"
        >
          <span className="flex h-28 w-28 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm">
            {codes[item.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={codes[item.id]} alt={`${item.label} QR code`} className="h-full w-full" />
            ) : (
              <span className="text-[10px] text-black/40">QR</span>
            )}
          </span>
          <span className="text-xs font-semibold text-gold">{item.label}</span>
        </a>
      ))}
    </div>
  );
}
