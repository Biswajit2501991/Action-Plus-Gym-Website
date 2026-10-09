"use client";

import { useEffect } from "react";
import { festivalIsLive, type FestivalSettings } from "@/lib/festival";

const ATTR = "data-festival";
const VALUE = "durga-puja";

function applyFestival(live: boolean) {
  const root = document.documentElement;
  if (live) root.setAttribute(ATTR, VALUE);
  else root.removeAttribute(ATTR);
}

export function FestivalTheme({
  settings,
}: {
  settings: FestivalSettings;
}) {
  const endsAt = settings.festival_ends_at || "";
  const live = festivalIsLive(settings);

  useEffect(() => {
    applyFestival(live);
    if (!live || !endsAt) {
      return () => applyFestival(false);
    }
    const end = new Date(endsAt).getTime();
    const ms = end - Date.now();
    if (!Number.isFinite(end) || ms <= 0) {
      applyFestival(false);
      return () => applyFestival(false);
    }
    const timer = window.setTimeout(() => applyFestival(false), ms);
    return () => {
      window.clearTimeout(timer);
      applyFestival(false);
    };
  }, [live, endsAt]);

  if (!live) return null;

  return (
    <div className="festival-decor" aria-hidden>
      <span className="festival-diya festival-diya-left" />
      <span className="festival-diya festival-diya-right" />
      <span className="festival-lotus" />
    </div>
  );
}

/** Drops a leaked festival attribute on member portal and admin. */
export function ClearFestivalTheme() {
  useEffect(() => {
    document.documentElement.removeAttribute(ATTR);
  }, []);
  return null;
}
