"use client";

import { useState, useTransition } from "react";
import { savePopupAction } from "@/lib/actions/admin";
import type { PopupOffer } from "@/lib/types";
import {
  AdminPageHeader,
  Field,
  SaveBar,
  TextInput,
  TextTextarea,
  Toggle,
} from "@/components/admin/form-ui";
import { MediaUrlField } from "@/components/admin/MediaUrlField";

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
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          await savePopupAction({
            ...form,
            expires_at: form.expires_at
              ? new Date(form.expires_at).toISOString()
              : "",
          });
          setMsg("Popup offer saved.");
        });
      }}
    >
      <AdminPageHeader
        title="Popup Offer"
        description="Welcome popup shown to visitors. Turn it off anytime."
      />

      <div className="grid max-w-3xl gap-3 rounded-2xl border border-white/10 bg-charcoal/40 p-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Toggle
            label="Show popup on website"
            hint="When off, visitors will not see this offer"
            checked={form.enabled}
            onChange={(next) => set("enabled", next)}
          />
        </div>
        <Field label="Title" className="md:col-span-2">
          <TextInput
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>
        <Field label="Message" className="md:col-span-2">
          <TextTextarea
            rows={3}
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
          />
        </Field>
        <MediaUrlField
          label="Image"
          className="md:col-span-2"
          value={form.image_url}
          onChange={(next) => set("image_url", next)}
          acceptKind="image"
          placeholder="Upload or paste image link"
        />
        <Field label="Button text">
          <TextInput
            value={form.button_text}
            onChange={(e) => set("button_text", e.target.value)}
          />
        </Field>
        <Field label="Button link">
          <TextInput
            value={form.button_href}
            onChange={(e) => set("button_href", e.target.value)}
            placeholder="#join"
          />
        </Field>
        <Field label="Background colour">
          <TextInput
            value={form.bg_color}
            onChange={(e) => set("bg_color", e.target.value)}
          />
        </Field>
        <Field label="Accent colour">
          <TextInput
            value={form.accent_color}
            onChange={(e) => set("accent_color", e.target.value)}
          />
        </Field>
        <Field label="Text colour">
          <TextInput
            value={form.text_color}
            onChange={(e) => set("text_color", e.target.value)}
          />
        </Field>
        <Field label="Expiry (optional)">
          <TextInput
            type="datetime-local"
            value={form.expires_at}
            onChange={(e) => set("expires_at", e.target.value)}
          />
        </Field>
      </div>

      <SaveBar pending={pending} message={msg} label="Save popup" />
    </form>
  );
}
