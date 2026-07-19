"use client";

import { useMemo, useState } from "react";
import { LeadRow } from "@/components/admin/LeadRow";

export type LeadItem = {
  id: number;
  full_name: string;
  email: string;
  mobile: string;
  status: string;
  intake_source: string;
  notes: string | null;
  interest_plan: string | null;
  created_at: string;
};

type Filter = "today" | "all";

function calendarKeyInIndia(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return String(iso || "").slice(0, 10);
  }
}

function todayKeyInIndia() {
  return calendarKeyInIndia(new Date().toISOString());
}

export function LeadsBoard({ leads }: { leads: LeadItem[] }) {
  const [filter, setFilter] = useState<Filter>("today");
  const todayKey = todayKeyInIndia();

  const todayLeads = useMemo(
    () => leads.filter((l) => calendarKeyInIndia(l.created_at) === todayKey),
    [leads, todayKey],
  );

  const visible = filter === "today" ? todayLeads : leads;
  const newTotal = leads.filter((l) => String(l.status || "New") === "New").length;
  const newToday = todayLeads.filter((l) => String(l.status || "New") === "New").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-white">Leads & Enquiries</h1>
          <p className="mt-1 text-sm text-muted">
            Website submissions synced to Gym Manager visitors.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white">
            Total {leads.length}
          </span>
          {newTotal > 0 ? (
            <span className="rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-gold">
              {newTotal} new
            </span>
          ) : (
            <span className="rounded-full border border-white/10 px-3 py-1 text-muted">
              No new leads
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("today")}
          className={
            filter === "today"
              ? "rounded-full bg-gold px-4 py-2 text-sm font-semibold text-black"
              : "rounded-full border border-white/15 px-4 py-2 text-sm text-muted hover:text-white"
          }
        >
          Today&apos;s leads ({todayLeads.length}
          {newToday ? ` · ${newToday} new` : ""})
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={
            filter === "all"
              ? "rounded-full bg-gold px-4 py-2 text-sm font-semibold text-black"
              : "rounded-full border border-white/15 px-4 py-2 text-sm text-muted hover:text-white"
          }
        >
          All leads ({leads.length})
        </button>
      </div>

      <div className="space-y-3">
        {visible.length === 0 ? (
          <p className="text-sm text-muted">
            {filter === "today"
              ? "No website leads today yet."
              : "No website leads yet."}
          </p>
        ) : (
          visible.map((lead) => <LeadRow key={lead.id} lead={lead} />)
        )}
      </div>
    </div>
  );
}
