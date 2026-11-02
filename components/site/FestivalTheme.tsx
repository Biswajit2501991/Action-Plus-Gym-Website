"use client";

import { useEffect, useMemo, useState } from "react";
import { DiwaliEffects } from "@/components/site/DiwaliEffects";
import {
  DIWALI_THEME,
  PREVIEW_QUERY,
  PREVIEW_STORAGE_KEY,
  festivalAttrValue,
  hydrateFestivalCatalog,
  liveFestivalTheme,
  parsePreviewTheme,
  type FestivalSettings,
  type FestivalThemeId,
} from "@/lib/festival";

const ATTR = "data-festival";
const MAX_TIMEOUT = 2_147_000_000;

function applyFestival(theme: FestivalThemeId | null) {
  const root = document.documentElement;
  const value = festivalAttrValue(theme);
  if (value) root.setAttribute(ATTR, value);
  else root.removeAttribute(ATTR);
}

function readPreview(): FestivalThemeId | null {
  try {
    const q = new URLSearchParams(window.location.search).get(PREVIEW_QUERY);
    const fromQuery = parsePreviewTheme(q);
    if (fromQuery) return fromQuery;
    return parsePreviewTheme(sessionStorage.getItem(PREVIEW_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function FestivalTheme({
  settings,
}: {
  settings: FestivalSettings;
}) {
  const catalog = useMemo(() => hydrateFestivalCatalog(settings), [settings]);
  const [preview, setPreview] = useState<FestivalThemeId | null>(null);
  const [clock, setClock] = useState(0);
  void clock;
  const live = liveFestivalTheme(settings, "website", Date.now());
  const theme = preview || live;

  useEffect(() => {
    setPreview(readPreview());
  }, []);

  useEffect(() => {
    applyFestival(theme);
    return () => applyFestival(null);
  }, [theme]);

  useEffect(() => {
    const timers: number[] = [];
    const schedule = (at: number) => {
      const ms = at - Date.now();
      if (!Number.isFinite(at) || ms <= 0) return;
      timers.push(
        window.setTimeout(() => setClock((n) => n + 1), Math.min(ms, MAX_TIMEOUT)),
      );
    };
    for (const cfg of Object.values(catalog)) {
      if (!cfg.enabled || !cfg.apply_website) continue;
      if (cfg.starts_at) schedule(new Date(cfg.starts_at).getTime());
      if (cfg.ends_at) schedule(new Date(cfg.ends_at).getTime());
    }
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [catalog]);

  if (!theme) return null;

  if (theme === DIWALI_THEME) {
    return (
      <div className="festival-decor" aria-hidden>
        <DiwaliEffects intensity="full" greeting />
      </div>
    );
  }

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
