"use client";

import { useState, useTransition } from "react";
import { savePopupAction } from "@/lib/actions/admin";
import type { PopupOffer } from "@/lib/types";

export function PopupEditor({ popup }: { popup: PopupOffer | null }) {
  const [form, setForm] = useState({
    enabled: popup?.enabled ?? false,
    title: popup?.title ?? "",
    body: popup?.body ?? "",
    image_url: popup?.image_url ?? "",
    button_text: popup?.button_text ?? "Claim Offer",
    button_href: popup?.button_href ?? "#join",
    bg_color: popup?.bg_color ?? "#0A0A0A",
    accent_color: popup?.accent_color ?? "#C9A227",
    text_color: popup?.text_color ?? "#FFFFFF",
    expires_at: popup?.expires_at
      ? new Date(popup.expires_at).toISOString().slice(0, 16)
      : "",
  });
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form
      className="grid max-w-2xl gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await savePopupAction({
            ...form,
            expires_at: form.expires_at
              ? new Date(form.expires_at).toISOString()
              : "",
          });
          setMsg("Popup saved.");
        });
      }}
    >
      <label className="flex items-center gap-3 text-sm text-white">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => set("enabled", e.target.checked)}
        />
        Enable popup
      </label>
      {(
        [
          ["title", "Title"],
          ["body", "Body"],
          ["image_url", "Image URL"],
          ["button_text", "Button text"],
          ["button_href", "Button link"],
          ["bg_color", "Background colour"],
          ["accent_color", "Accent colour"],
          ["text_color", "Text colour"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="block text-sm">
          <span className="mb-1 block text-muted">{label}</span>
          {key === "body" ? (
            <textarea
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2"
            />
          ) : (
            <input
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2"
            />
          )}
        </label>
      ))}
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Expiry (optional)</span>
        <input
          type="datetime-local"
          value={form.expires_at}
          onChange={(e) => set("expires_at", e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black"
      >
        {pending ? "Saving..." : "Save popup"}
      </button>
      {msg ? <p className="text-sm text-emerald-300">{msg}</p> : null}
    </form>
  );
}
