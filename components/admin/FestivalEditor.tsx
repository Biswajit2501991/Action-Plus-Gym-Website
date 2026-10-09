"use client";

import { useState, useTransition } from "react";
import { saveFestivalAction } from "@/lib/actions/admin";
import {
  festivalStatusLabel,
  isoToIstDatetimeLocal,
  istDatetimeLocalToIso,
} from "@/lib/festival";
import type { WebsiteSettings } from "@/lib/types";
import { AdminPageHeader, Field, SaveBar, Toggle } from "@/components/admin/form-ui";

export function FestivalEditor({ settings }: { settings: WebsiteSettings }) {
  const [enabled, setEnabled] = useState(Boolean(settings.festival_enabled));
  const [starts, setStarts] = useState(isoToIstDatetimeLocal(settings.festival_starts_at));
  const [ends, setEnds] = useState(isoToIstDatetimeLocal(settings.festival_ends_at));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState({
    festival_enabled: Boolean(settings.festival_enabled),
    festival_theme: settings.festival_theme || "",
    festival_starts_at: settings.festival_starts_at || null,
    festival_ends_at: settings.festival_ends_at || null,
  });

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        const startsAt = istDatetimeLocalToIso(starts);
        const endsAt = istDatetimeLocalToIso(ends);
        if (enabled && (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt))) {
          setMsg("Set a start and an end in IST. The end must be after the start.");
          return;
        }
        startTransition(async () => {
          const result = await saveFestivalAction({
            enabled,
            starts_at: startsAt,
            ends_at: endsAt,
          });
          if (!result.ok) {
            setMsg(result.error || "Could not save the festival theme.");
            return;
          }
          const next = {
            festival_enabled: enabled,
            festival_theme: enabled ? "durga_puja" : "",
            festival_starts_at: startsAt || null,
            festival_ends_at: endsAt || null,
          };
          setSaved(next);
          setMsg("Durga Puja theme saved.");
        });
      }}
    >
      <AdminPageHeader
        title="Durga Puja"
        description="Turns the public website festive for the IST window you set. The member portal stays as it is. After the end time, the normal theme returns on its own."
      />

      <div className="grid max-w-3xl gap-3 rounded-2xl border border-white/10 bg-charcoal/40 p-4">
        <Toggle
          label="Durga Puja theme"
          hint="Off returns the public site to the current theme immediately"
          checked={enabled}
          onChange={setEnabled}
        />
        <Field label="Starts (IST)">
          <input
            type="datetime-local"
            value={starts}
            onChange={(e) => setStarts(e.target.value)}
            className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white"
          />
        </Field>
        <Field label="Ends (IST)">
          <input
            type="datetime-local"
            value={ends}
            onChange={(e) => setEnds(e.target.value)}
            className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white"
          />
        </Field>
        <p className="text-sm text-muted">{festivalStatusLabel(saved)}</p>
      </div>

      <SaveBar pending={pending} message={msg} />
    </form>
  );
}
