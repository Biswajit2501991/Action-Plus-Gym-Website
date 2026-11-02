"use client";

import { useMemo, useState, useTransition } from "react";
import { saveFestivalAction } from "@/lib/actions/admin";
import {
  CHHATH_PUJA_THEME,
  DIWALI_THEME,
  DURGA_PUJA_THEME,
  NEW_YEAR_2027_THEME,
  FESTIVAL_THEME_META,
  PREVIEW_QUERY,
  PREVIEW_STORAGE_KEY,
  festivalStatus,
  festivalWindowError,
  hydrateFestivalCatalog,
  isoToIstDatetimeLocal,
  istDatetimeLocalToIso,
  overlappingFestivalError,
  type FestivalThemeId,
} from "@/lib/festival";
import type { WebsiteSettings } from "@/lib/types";
import { AdminPageHeader, Field, SaveBar, Toggle } from "@/components/admin/form-ui";

type SelectKey = "default" | FestivalThemeId;

function applyLabel(website: boolean, gym: boolean) {
  if (website && gym) return "both";
  if (gym) return "gym";
  return "website";
}

export function FestivalEditor({ settings }: { settings: WebsiteSettings }) {
  const initial = useMemo(() => hydrateFestivalCatalog(settings), [settings]);
  const [catalog, setCatalog] = useState(initial);
  const [selected, setSelected] = useState<SelectKey>(() => {
    if (initial.new_year_2027.enabled) return NEW_YEAR_2027_THEME;
    if (initial.chhath_puja.enabled) return CHHATH_PUJA_THEME;
    if (initial.diwali.enabled) return DIWALI_THEME;
    if (initial.durga_puja.enabled) return DURGA_PUJA_THEME;
    return "default";
  });
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const current = selected === "default" ? null : catalog[selected];
  const status = current ? festivalStatus(current) : { kind: "disabled" as const, label: "Default theme. Festival skins stay off until you enable one." };

  function patchSelected(patch: Partial<(typeof catalog)[FestivalThemeId]>) {
    if (selected === "default") return;
    setCatalog((prev) => ({
      ...prev,
      [selected]: { ...prev[selected], ...patch },
    }));
  }

  function preview() {
    if (selected === "default") {
      try {
        sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      window.open("/", "_blank", "noopener,noreferrer");
      return;
    }
    try {
      sessionStorage.setItem(PREVIEW_STORAGE_KEY, selected);
    } catch {
      /* ignore */
    }
    window.open(`/?${PREVIEW_QUERY}=${encodeURIComponent(selected)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        if (selected === "default") {
          startTransition(async () => {
            const result = await saveFestivalAction({
              theme: "default",
              enabled: false,
              starts_at: "",
              ends_at: "",
            });
            if (!result.ok) {
              setMsg(result.error || "Could not save the festival theme.");
              return;
            }
            setCatalog((prev) => ({
              ...prev,
              durga_puja: { ...prev.durga_puja, enabled: false },
              diwali: { ...prev.diwali, enabled: false },
              chhath_puja: { ...prev.chhath_puja, enabled: false },
              new_year_2027: { ...prev.new_year_2027, enabled: false },
            }));
            setMsg("Default theme saved. Festival dates are kept for later.");
          });
          return;
        }
        const cfg = catalog[selected];
        const startsAt = istDatetimeLocalToIso(isoToIstDatetimeLocal(cfg.starts_at) || "") || (cfg.starts_at || "");
        const endsAt = istDatetimeLocalToIso(isoToIstDatetimeLocal(cfg.ends_at) || "") || (cfg.ends_at || "");
        const windowErr = festivalWindowError(cfg.enabled, startsAt, endsAt);
        if (windowErr) {
          setMsg(windowErr);
          return;
        }
        const overlap = overlappingFestivalError(catalog, selected, { ...cfg, starts_at: startsAt || null, ends_at: endsAt || null });
        if (overlap) {
          setMsg(overlap);
          return;
        }
        if (!cfg.apply_website && !cfg.apply_gym_manager) {
          setMsg("Choose where this theme applies: website, Gym Manager, or both.");
          return;
        }
        startTransition(async () => {
          const result = await saveFestivalAction({
            theme: selected,
            enabled: cfg.enabled,
            starts_at: startsAt,
            ends_at: endsAt,
            apply_website: cfg.apply_website,
            apply_gym_manager: cfg.apply_gym_manager,
          });
          if (!result.ok) {
            setMsg(result.error || "Could not save the festival theme.");
            return;
          }
          setCatalog((prev) => ({
            ...prev,
            [selected]: {
              ...cfg,
              starts_at: startsAt || null,
              ends_at: endsAt || null,
            },
          }));
          setMsg(`${FESTIVAL_THEME_META[selected].label} saved.`);
        });
      }}
    >
      <AdminPageHeader
        title="Themes"
        description="Seasonal looks for the public website and, if you choose, Gym Manager. Times are IST (Asia/Kolkata). The member portal stays as it is. After the end time, the normal theme returns on its own."
      />

      <div className="grid max-w-3xl gap-3 rounded-2xl border border-white/10 bg-charcoal/40 p-4">
        <Field label="Theme">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value as SelectKey)}
            className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white"
          >
            <option value="default">Default Theme</option>
            <option value={DURGA_PUJA_THEME}>Durga Puja Theme</option>
            <option value={DIWALI_THEME}>Diwali Theme</option>
            <option value={CHHATH_PUJA_THEME}>Chhath Puja Theme</option>
            <option value={NEW_YEAR_2027_THEME}>New Year 2027 🎆</option>
          </select>
        </Field>

        {current ? (
          <>
            <Toggle
              label="Enable this theme"
              hint="Off keeps the dates but never shows this skin"
              checked={current.enabled}
              onChange={(enabled) => patchSelected({ enabled })}
            />
            <Field label="Starts (IST)">
              <input
                type="datetime-local"
                value={isoToIstDatetimeLocal(current.starts_at)}
                onChange={(e) =>
                  patchSelected({ starts_at: istDatetimeLocalToIso(e.target.value) || null })
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white"
              />
            </Field>
            <Field label="Ends (IST)">
              <input
                type="datetime-local"
                value={isoToIstDatetimeLocal(current.ends_at)}
                onChange={(e) =>
                  patchSelected({ ends_at: istDatetimeLocalToIso(e.target.value) || null })
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white"
              />
            </Field>
            <Field label="Apply to">
              <select
                value={applyLabel(current.apply_website, current.apply_gym_manager)}
                onChange={(e) => {
                  const v = e.target.value;
                  patchSelected({
                    apply_website: v === "website" || v === "both",
                    apply_gym_manager: v === "gym" || v === "both",
                  });
                }}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white"
              >
                <option value="website">Public Website Only</option>
                <option value="gym">Gym Management App Only</option>
                <option value="both">Both Website and Gym Management App</option>
              </select>
            </Field>
          </>
        ) : (
          <p className="text-sm text-muted">
            Saving Default turns every festival off. Saved start and end times stay for reuse.
          </p>
        )}

        <p className="text-sm text-muted">
          Status:{" "}
          <span className="text-white/80">
            {status.kind === "active"
              ? "Active"
              : status.kind === "scheduled"
                ? "Scheduled"
                : status.kind === "expired"
                  ? "Expired"
                  : "Disabled"}
          </span>
          {" — "}
          {status.label}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={preview}
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:border-gold hover:text-gold"
          >
            Preview Theme
          </button>
        </div>
      </div>

      <SaveBar pending={pending} message={msg} />
    </form>
  );
}
