"use client";

import { useState, useTransition } from "react";

export function SyncGoogleReviewsButton() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const res = await fetch("/api/reviews/sync", { method: "POST" });
            const data = (await res.json()) as { ok: boolean; error?: string };
            if (data.ok) {
              setMsg("Synced from Google. Refresh this page to edit the cache.");
            } else {
              setMsg(data.error || "Sync failed.");
            }
          });
        }}
        className="rounded-full border border-gold/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/10 disabled:opacity-50"
      >
        {pending ? "Syncing…" : "Sync live Google reviews"}
      </button>
      {msg ? <p className="text-sm text-muted">{msg}</p> : null}
    </div>
  );
}
