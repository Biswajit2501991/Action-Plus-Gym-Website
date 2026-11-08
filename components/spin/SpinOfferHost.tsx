"use client";

import { useEffect, useState } from "react";
import { SpinWheelModal, type SpinPrize } from "@/components/spin/SpinWheelModal";
import type { SpinSlice } from "@/components/spin/SpinWheel";

type LiveWheel = {
  active?: boolean;
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
  segments?: SpinSlice[];
  closeOverlay?: boolean;
  cooldownHours?: number;
  popupDelaySec?: number;
};

export function SpinOfferHost({ surface }: { surface: "website" | "member_portal" }) {
  const [live, setLive] = useState<LiveWheel | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const hideKey = `apg_spin_hide_${surface}`;
    fetch(`/api/spin-wheel/config?surface=${surface}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((payload: LiveWheel) => {
        if (cancelled || !payload?.active || !payload.segments?.length) return;
        const hiddenUntil = Number(window.localStorage.getItem(hideKey) || 0);
        if (hiddenUntil > Date.now()) return;
        setLive(payload);
        const delay = Math.min(30, Math.max(0, Number(payload.popupDelaySec || 0))) * 1000;
        timer = window.setTimeout(() => {
          if (!cancelled) setOpen(true);
        }, delay);
      })
      .catch(() => {
        /* A missing wheel stays hidden. */
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [surface]);

  if (!live) return null;

  function hide() {
    const hours = Math.max(1, Number(live?.cooldownHours || 24));
    window.localStorage.setItem(`apg_spin_hide_${surface}`, String(Date.now() + hours * 60 * 60 * 1000));
    setOpen(false);
  }

  return (
    <SpinWheelModal
      open={open}
      title={live.title || "Spin & Win"}
      subtitle={live.subtitle || ""}
      buttonLabel={live.buttonLabel || "SPIN"}
      segments={live.segments || []}
      closeOverlay={live.closeOverlay !== false}
      onClose={hide}
      onSpin={async () => {
        const res = await fetch("/api/spin-wheel/spin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            surface,
            visitorKey: surface === "website" ? visitorKey() : undefined,
          }),
        });
        const payload = (await res.json().catch(() => null)) as SpinPrize | null;
        if (!res.ok || !payload || typeof payload.segmentIndex !== "number") {
          throw new Error("spin-failed");
        }
        return payload;
      }}
    />
  );
}

function visitorKey() {
  const storageKey = "apg_spin_visitor";
  const existing = window.localStorage.getItem(storageKey);
  if (existing && /^[A-Za-z0-9_-]{16,80}$/.test(existing)) return existing;
  const next =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  window.localStorage.setItem(storageKey, next.slice(0, 80));
  return next.slice(0, 80);
}
