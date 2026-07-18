"use client";

import { useState, useTransition } from "react";
import { updateLeadAction } from "@/lib/actions/admin";

export function LeadRow({
  lead,
}: {
  lead: {
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
}) {
  const [status, setStatus] = useState(lead.status || "New");
  const [notes, setNotes] = useState(lead.notes || "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <article className="rounded-2xl border border-white/10 bg-charcoal/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-white">{lead.full_name}</h3>
          <p className="text-sm text-muted">
            {lead.mobile} · {lead.email || "No email"}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wider text-gold">
            {lead.intake_source}
            {lead.interest_plan ? ` · ${lead.interest_plan}` : ""}
          </p>
        </div>
        <p className="text-xs text-muted">
          {new Date(lead.created_at).toLocaleString()}
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr_auto]">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
        >
          {["New", "Contacted", "Follow-up", "Converted", "Closed"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Staff notes / reply"
          className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await updateLeadAction(lead.id, status, notes);
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            });
          }}
          className="rounded-xl gold-gradient px-4 py-2 text-sm font-semibold text-black"
        >
          {pending ? "..." : saved ? "Saved" : "Save"}
        </button>
      </div>
    </article>
  );
}
