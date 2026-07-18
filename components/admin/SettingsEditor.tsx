"use client";

import { useState, useTransition } from "react";
import { saveSettingsAction } from "@/lib/actions/admin";
import type { WebsiteSettings } from "@/lib/types";

export function SettingsEditor({ settings }: { settings: WebsiteSettings }) {
  const [form, setForm] = useState({
    site_name: settings.site_name,
    tagline: settings.tagline,
    phone: settings.phone,
    email: settings.email,
    whatsapp: settings.whatsapp,
    address: settings.address,
    map_embed_url: settings.map_embed_url,
    google_reviews_url: settings.google_reviews_url,
    timezone: settings.timezone,
    seo_title: settings.seo_title,
    seo_description: settings.seo_description,
    seo_og_image: settings.seo_og_image,
    hero_headline: settings.hero_headline,
    hero_subheadline: settings.hero_subheadline,
    instagram: settings.socials?.instagram || "",
    facebook: settings.socials?.facebook || "",
    youtube: settings.socials?.youtube || "",
  });
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="grid max-w-3xl gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await saveSettingsAction({
            ...form,
            socials: {
              instagram: form.instagram,
              facebook: form.facebook,
              youtube: form.youtube,
            },
          });
          setMsg("Settings saved.");
        });
      }}
    >
      {Object.entries(form).map(([key, value]) => (
        <label
          key={key}
          className={`block text-sm ${
            key.includes("headline") ||
            key.includes("description") ||
            key === "address"
              ? "md:col-span-2"
              : ""
          }`}
        >
          <span className="mb-1 block capitalize text-muted">
            {key.replaceAll("_", " ")}
          </span>
          {key.includes("description") ||
          key.includes("subheadline") ||
          key === "address" ? (
            <textarea
              value={value}
              onChange={(e) =>
                setForm((f) => ({ ...f, [key]: e.target.value }))
              }
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2"
            />
          ) : (
            <input
              value={value}
              onChange={(e) =>
                setForm((f) => ({ ...f, [key]: e.target.value }))
              }
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2"
            />
          )}
        </label>
      ))}
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black"
        >
          {pending ? "Saving..." : "Save settings"}
        </button>
        {msg ? <p className="mt-2 text-sm text-emerald-300">{msg}</p> : null}
      </div>
    </form>
  );
}
