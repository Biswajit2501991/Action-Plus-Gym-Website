"use client";

import { useState } from "react";
import { Field, TextInput } from "@/components/admin/form-ui";
import { MediaLibrary } from "@/components/admin/MediaLibrary";

export function MediaUrlField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  className,
  acceptKind = "any",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  acceptKind?: "image" | "video" | "any";
}) {
  const [open, setOpen] = useState(false);
  const isImage =
    acceptKind === "image" ||
    (acceptKind === "any" && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(value));

  return (
    <>
      <Field label={label} hint={hint} className={className}>
        <div className="space-y-2">
          <TextInput
            type="url"
            value={value}
            placeholder={placeholder || "https://... or upload from Media Library"}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-full border border-gold/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/10"
            >
              Upload / Library
            </button>
            {value && isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={value}
                alt=""
                className="h-10 w-16 rounded-lg object-cover border border-white/10"
              />
            ) : null}
          </div>
        </div>
      </Field>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 md:p-8">
          <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-[#0c0c0c] p-5 shadow-2xl md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="font-display text-2xl text-white">Choose media</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70"
              >
                Close
              </button>
            </div>
            <MediaLibrary
              pickMode
              acceptKind={acceptKind}
              onPick={(url) => {
                onChange(url);
                setOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
