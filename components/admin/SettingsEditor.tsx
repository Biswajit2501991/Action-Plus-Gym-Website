"use client";

import { useState, useTransition } from "react";
import { saveSettingsAction } from "@/lib/actions/admin";
import type { WebsiteSettings } from "@/lib/types";
import {
  AdminPageHeader,
  Field,
  SaveBar,
  TextInput,
  TextSelect,
  TextTextarea,
} from "@/components/admin/form-ui";
import { MediaUrlField } from "@/components/admin/MediaUrlField";

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "UTC", label: "UTC" },
] as const;

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
    timezone: settings.timezone || "Asia/Kolkata",
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

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          await saveSettingsAction({
            ...form,
            socials: {
              instagram: form.instagram,
              facebook: form.facebook,
              youtube: form.youtube,
            },
          });
          setMsg("Contact & brand details saved.");
        });
      }}
    >
      <AdminPageHeader
        title="Contact & Brand"
        description="Phone, address, WhatsApp, social links, SEO text, and hero headlines."
      />

      <section className="space-y-3 rounded-2xl border border-white/10 bg-charcoal/40 p-4 md:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">
          Gym identity
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Gym name">
            <TextInput
              value={form.site_name}
              onChange={(e) => set("site_name", e.target.value)}
            />
          </Field>
          <Field label="Tagline">
            <TextInput
              value={form.tagline}
              onChange={(e) => set("tagline", e.target.value)}
            />
          </Field>
          <Field label="Hero headline" className="md:col-span-2">
            <TextInput
              value={form.hero_headline}
              onChange={(e) => set("hero_headline", e.target.value)}
            />
          </Field>
          <Field label="Hero supporting text" className="md:col-span-2">
            <TextTextarea
              rows={3}
              value={form.hero_subheadline}
              onChange={(e) => set("hero_subheadline", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-charcoal/40 p-4 md:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">
          Contact details
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Phone" hint="Shown on website and call button">
            <TextInput
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+91 70471 57510"
            />
          </Field>
          <Field label="WhatsApp number" hint="Digits with country code, e.g. 917047157510">
            <TextInput
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
              placeholder="917047157510"
            />
          </Field>
          <Field label="Email">
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label="Timezone">
            <TextSelect
              value={form.timezone}
              onChange={(e) => set("timezone", e.target.value)}
            >
              {!TIMEZONES.some((tz) => tz.value === form.timezone) ? (
                <option value={form.timezone}>{form.timezone}</option>
              ) : null}
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field label="Address" className="md:col-span-2">
            <TextTextarea
              rows={3}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </Field>
          <Field label="Google Maps embed URL" className="md:col-span-2">
            <TextInput
              value={form.map_embed_url}
              onChange={(e) => set("map_embed_url", e.target.value)}
              placeholder="https://www.google.com/maps/embed?..."
            />
          </Field>
          <Field label="Google reviews page URL" className="md:col-span-2">
            <TextInput
              value={form.google_reviews_url}
              onChange={(e) => set("google_reviews_url", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-charcoal/40 p-4 md:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">
          Social links
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Instagram">
            <TextInput
              value={form.instagram}
              onChange={(e) => set("instagram", e.target.value)}
            />
          </Field>
          <Field label="Facebook">
            <TextInput
              value={form.facebook}
              onChange={(e) => set("facebook", e.target.value)}
            />
          </Field>
          <Field label="YouTube">
            <TextInput
              value={form.youtube}
              onChange={(e) => set("youtube", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-charcoal/40 p-4 md:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">
          SEO (Google search)
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Page title">
            <TextInput
              value={form.seo_title}
              onChange={(e) => set("seo_title", e.target.value)}
            />
          </Field>
          <MediaUrlField
            label="Share image"
            value={form.seo_og_image}
            onChange={(next) => set("seo_og_image", next)}
            acceptKind="image"
            placeholder="Upload or paste image link"
          />
          <Field label="Short description" className="md:col-span-2">
            <TextTextarea
              rows={3}
              value={form.seo_description}
              onChange={(e) => set("seo_description", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <SaveBar pending={pending} message={msg} label="Save contact & brand" />
    </form>
  );
}
