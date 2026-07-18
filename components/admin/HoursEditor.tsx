"use client";

import { useMemo, useState, useTransition } from "react";
import { replaceCollectionAction } from "@/lib/actions/admin";
import type { OpeningHour } from "@/lib/types";
import {
  AdminPageHeader,
  Field,
  SaveBar,
  TextInput,
  Toggle,
} from "@/components/admin/form-ui";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

type DayRow = {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  is_hidden: boolean;
};

function toTimeInput(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 5);
}

function toDbTime(value: string) {
  if (!value) return "";
  return value.length === 5 ? `${value}:00` : value;
}

function buildWeek(hours: OpeningHour[]): DayRow[] {
  return DAYS.map((_, day) => {
    const existing = hours.find((h) => h.day_of_week === day);
    return {
      day_of_week: day,
      open_time: toTimeInput(existing?.open_time),
      close_time: toTimeInput(existing?.close_time),
      is_closed: existing?.is_closed ?? false,
      is_hidden: existing?.is_hidden ?? false,
    };
  });
}

export function HoursEditor({ hours }: { hours: OpeningHour[] }) {
  const [rows, setRows] = useState<DayRow[]>(() => buildWeek(hours));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const summary = useMemo(() => {
    const open = rows.filter((r) => !r.is_closed && !r.is_hidden).length;
    return `${open} open day${open === 1 ? "" : "s"} this week`;
  }, [rows]);

  function update(day: number, patch: Partial<DayRow>) {
    setRows((prev) =>
      prev.map((row) => (row.day_of_week === day ? { ...row, ...patch } : row)),
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          await replaceCollectionAction(
            "website_opening_hours",
            rows.map((row) => ({
              day_of_week: row.day_of_week,
              open_time: row.is_closed ? "" : toDbTime(row.open_time),
              close_time: row.is_closed ? "" : toDbTime(row.close_time),
              is_closed: row.is_closed,
              is_hidden: row.is_hidden,
            })),
          );
          setMsg("Opening hours saved.");
        });
      }}
    >
      <AdminPageHeader
        title="Opening Hours"
        description={`${summary}. Set open/close times for each day. Mark a day Closed or Hide it from the website.`}
      />

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.day_of_week}
            className="rounded-2xl border border-white/10 bg-charcoal/40 p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-xl text-white">
                {DAYS[row.day_of_week]}
              </p>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs ${
                    row.is_hidden
                      ? "bg-white/10 text-muted"
                      : row.is_closed
                        ? "bg-red-500/15 text-red-300"
                        : "bg-emerald-500/15 text-emerald-300"
                  }`}
                >
                  {row.is_hidden
                    ? "Hidden"
                    : row.is_closed
                      ? "Closed"
                      : "Open"}
                </span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Opens">
                <TextInput
                  type="time"
                  value={row.open_time}
                  disabled={row.is_closed}
                  onChange={(e) => update(row.day_of_week, { open_time: e.target.value })}
                />
              </Field>
              <Field label="Closes">
                <TextInput
                  type="time"
                  value={row.close_time}
                  disabled={row.is_closed}
                  onChange={(e) =>
                    update(row.day_of_week, { close_time: e.target.value })
                  }
                />
              </Field>
              <Toggle
                label="Closed all day"
                hint="No opening hours for this day"
                checked={row.is_closed}
                onChange={(next) => update(row.day_of_week, { is_closed: next })}
              />
              <Toggle
                label="Hide on website"
                hint="Do not show this day in the hours list"
                checked={row.is_hidden}
                onChange={(next) => update(row.day_of_week, { is_hidden: next })}
              />
            </div>
          </div>
        ))}
      </div>

      <SaveBar pending={pending} message={msg} label="Save opening hours" />
    </form>
  );
}
