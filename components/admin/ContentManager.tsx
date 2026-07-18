"use client";

import { useEffect, useState, useTransition } from "react";
import {
  replaceCollectionAction,
  saveReviewsAction,
} from "@/lib/actions/admin";
import type { SiteContent } from "@/lib/types";

type Tab =
  | "stats"
  | "hero"
  | "services"
  | "pricing"
  | "trainers"
  | "gallery"
  | "videos"
  | "testimonials"
  | "hours"
  | "reviews";

function dataForTab(tab: Tab, content: SiteContent) {
  switch (tab) {
    case "stats":
      return content.stats;
    case "hero":
      return content.heroSlides;
    case "services":
      return content.services;
    case "pricing":
      return content.pricing;
    case "trainers":
      return content.trainers;
    case "gallery":
      return content.gallery;
    case "videos":
      return content.videos;
    case "testimonials":
      return content.testimonials;
    case "hours":
      return content.hours;
    case "reviews":
      return content.reviews;
  }
}

export function ContentManager({ content }: { content: SiteContent }) {
  const [tab, setTab] = useState<Tab>("services");
  const [json, setJson] = useState(() =>
    JSON.stringify(content.services, null, 2),
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setJson(JSON.stringify(dataForTab(tab, content), null, 2));
    setMsg(null);
  }, [tab, content]);

  const tableMap: Record<Exclude<Tab, "reviews">, string> = {
    stats: "website_stats",
    hero: "website_hero_slides",
    services: "website_services",
    pricing: "website_pricing_plans",
    trainers: "website_trainers",
    gallery: "website_gallery_images",
    videos: "website_videos",
    testimonials: "website_testimonials",
    hours: "website_opening_hours",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            "stats",
            "hero",
            "services",
            "pricing",
            "trainers",
            "gallery",
            "videos",
            "testimonials",
            "hours",
            "reviews",
          ] as Tab[]
        ).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-wider ${
              tab === t
                ? "gold-gradient text-black"
                : "border border-white/15 text-white/70"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted">
        Edit the JSON below, then save. Gallery items need `image_url`,
        `alt_text`, `sort_order`. Hours use `day_of_week` 0–6 (Sunday=0) and
        times as HH:MM:SS.
      </p>

      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={22}
        className="w-full rounded-2xl border border-white/10 bg-black/50 p-4 font-mono text-xs text-white"
      />

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            try {
              const parsed = JSON.parse(json);
              if (tab === "reviews") {
                await saveReviewsAction(parsed);
              } else {
                await replaceCollectionAction(tableMap[tab], parsed);
              }
              setMsg("Saved. Refresh the public site to see changes.");
            } catch {
              setMsg("Invalid JSON. Please fix and try again.");
            }
          });
        }}
        className="rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black"
      >
        {pending ? "Saving..." : `Save ${tab}`}
      </button>
      {msg ? <p className="text-sm text-emerald-300">{msg}</p> : null}
    </div>
  );
}
