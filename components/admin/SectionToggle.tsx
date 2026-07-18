"use client";

import { useState, useTransition } from "react";
import { setSectionAction } from "@/lib/actions/admin";

const LABELS: Record<string, string> = {
  hero: "Hero banner",
  stats: "Statistics",
  services: "Services",
  pricing: "Pricing plans",
  trainers: "Trainers",
  gallery: "Gallery",
  videos: "Videos",
  testimonials: "Testimonials",
  hours: "Opening hours",
  reviews: "Google reviews",
  contact: "Join / Contact form",
  popup: "Popup offer",
  footer: "Footer",
};

export function SectionToggle({
  sectionKey,
  enabled,
}: {
  sectionKey: string;
  enabled: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();
  const label = LABELS[sectionKey] || sectionKey.replaceAll("_", " ");

  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-charcoal/40 px-4 py-4">
      <div>
        <p className="text-white">{label}</p>
        <p className="text-xs text-muted">Show this block on the public website</p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const next = !on;
          setOn(next);
          startTransition(async () => {
            await setSectionAction(sectionKey, next);
          });
        }}
        className={`relative h-8 w-14 rounded-full transition ${
          on ? "bg-gold" : "bg-white/15"
        }`}
        aria-pressed={on}
        aria-label={`${on ? "Hide" : "Show"} ${label}`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-black transition ${
            on ? "left-7" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
