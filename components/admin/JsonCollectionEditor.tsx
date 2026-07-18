"use client";

import { useEffect, useState, useTransition } from "react";
import {
  replaceCollectionAction,
  saveReviewsAction,
} from "@/lib/actions/admin";

export function JsonCollectionEditor({
  title,
  description,
  initialData,
  table,
  mode = "collection",
}: {
  title: string;
  description: string;
  initialData: unknown;
  table?: string;
  mode?: "collection" | "reviews";
}) {
  const [json, setJson] = useState(() => JSON.stringify(initialData, null, 2));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setJson(JSON.stringify(initialData, null, 2));
  }, [initialData]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-white">{title}</h1>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={20}
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
              if (mode === "reviews") {
                await saveReviewsAction(parsed);
              } else if (table) {
                await replaceCollectionAction(table, parsed);
              }
              setMsg("Saved. Refresh the public site to see changes.");
            } catch {
              setMsg("Invalid JSON. Please fix and try again.");
            }
          });
        }}
        className="rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black"
      >
        {pending ? "Saving..." : "Save changes"}
      </button>
      {msg ? <p className="text-sm text-emerald-300">{msg}</p> : null}
    </div>
  );
}
