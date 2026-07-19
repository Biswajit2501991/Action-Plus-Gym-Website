"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  deleteWebsiteMediaAction,
  listWebsiteMediaAction,
  uploadWebsiteMediaAction,
} from "@/lib/actions/admin";
import type { WebsiteMedia } from "@/lib/types";
import {
  AdminPageHeader,
  Field,
  TextInput,
  TextSelect,
} from "@/components/admin/form-ui";

const SECTION_TAGS = [
  { value: "", label: "General" },
  { value: "hero", label: "Hero" },
  { value: "gallery", label: "Gallery" },
  { value: "videos", label: "Videos" },
  { value: "trainers", label: "Trainers" },
  { value: "services", label: "Services" },
  { value: "testimonials", label: "Testimonials" },
  { value: "popup", label: "Popup" },
  { value: "brand", label: "Brand / SEO" },
];

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaLibrary({
  pickMode = false,
  acceptKind,
  onPick,
}: {
  pickMode?: boolean;
  acceptKind?: "image" | "video" | "any";
  onPick?: (url: string, item: WebsiteMedia) => void;
}) {
  const [items, setItems] = useState<WebsiteMedia[]>([]);
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [sectionTag, setSectionTag] = useState("");
  const [altText, setAltText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    startTransition(async () => {
      const res = await listWebsiteMediaAction();
      if (res?.ok === false) {
        setError(res.error || "Could not load media.");
        setItems([]);
      } else {
        setItems((res?.items as WebsiteMedia[]) || []);
        setError(null);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visible = items.filter((item) => {
    if (acceptKind === "image" && item.kind !== "image") return false;
    if (acceptKind === "video" && item.kind !== "video") return false;
    if (filter !== "all" && item.kind !== filter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {!pickMode ? (
        <AdminPageHeader
          title="Media Library"
          description="Upload images and videos once, save them in the database, then reuse the link in Hero, Gallery, Trainers, Videos, and other sections."
        />
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-charcoal/40 p-4 md:p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-gold">
          Upload files
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Section tag">
            <TextSelect
              value={sectionTag}
              onChange={(e) => setSectionTag(e.target.value)}
            >
              {SECTION_TAGS.map((tag) => (
                <option key={tag.value || "general"} value={tag.value}>
                  {tag.label}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field label="Alt / caption (optional)" className="md:col-span-2">
            <TextInput
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Trainer photo, gym floor…"
            />
          </Field>
        </div>
        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-gold/40 bg-black/30 px-6 py-10 text-center transition hover:bg-black/50">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            multiple
            className="hidden"
            disabled={pending}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              if (!files.length) return;
              setMsg(null);
              setError(null);
              startTransition(async () => {
                let okCount = 0;
                for (const file of files) {
                  const fd = new FormData();
                  fd.set("file", file);
                  fd.set("section_tag", sectionTag);
                  fd.set("alt_text", altText);
                  const res = await uploadWebsiteMediaAction(fd);
                  if (res.ok) okCount += 1;
                  else {
                    setError(res.error || "Upload failed.");
                    break;
                  }
                }
                if (okCount) {
                  setMsg(
                    okCount === 1
                      ? "1 file uploaded and saved."
                      : `${okCount} files uploaded and saved.`,
                  );
                  refresh();
                }
              });
            }}
          />
          <p className="font-display text-xl text-white">
            {pending ? "Uploading…" : "Click to upload images or videos"}
          </p>
          <p className="mt-2 text-xs text-muted">
            Images up to 10 MB · Videos up to 50 MB · Saved to Supabase Storage +
            database
          </p>
          <p className="mt-2 max-w-lg text-[11px] text-white/45">
            Uploads need Railway variable{" "}
            <span className="text-white/70">SUPABASE_SERVICE_ROLE_KEY</span> =
            Supabase <span className="text-white/70">service_role</span> key
            (not JWT Secret, not anon key).
          </p>
        </label>
        {msg ? <p className="mt-3 text-sm text-emerald-300">{msg}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["all", "image", "video"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-wider ${
                filter === key
                  ? "gold-gradient text-black"
                  : "border border-white/15 text-white/70"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{visible.length} file(s)</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading media…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center text-sm text-muted">
          No media yet. Upload your first image or video above.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-charcoal/40"
            >
              <div className="relative aspect-video bg-black/50">
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.public_url}
                    alt={item.alt_text || item.file_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <video
                    src={item.public_url}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    controls
                  />
                )}
              </div>
              <div className="space-y-2 p-3">
                <p className="truncate text-sm text-white">{item.file_name}</p>
                <p className="text-xs text-muted">
                  {item.kind} · {formatBytes(item.file_size)}
                  {item.section_tag ? ` · ${item.section_tag}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {pickMode && onPick ? (
                    <button
                      type="button"
                      onClick={() => onPick(item.public_url, item)}
                      className="rounded-full gold-gradient px-3 py-1.5 text-xs font-semibold text-black"
                    >
                      Use this file
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(item.public_url);
                        setMsg("Link copied. Paste it into any section URL field.");
                      }}
                      className="rounded-full border border-gold/40 px-3 py-1.5 text-xs text-gold"
                    >
                      Copy link
                    </button>
                  )}
                  {!pickMode ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`Delete ${item.file_name}?`)) return;
                        startTransition(async () => {
                          const res = await deleteWebsiteMediaAction(item.id);
                          if (res?.ok === false) {
                            setError(res.error || "Delete failed.");
                          } else {
                            setMsg("Media deleted.");
                            refresh();
                          }
                        });
                      }}
                      className="rounded-full border border-red-400/30 px-3 py-1.5 text-xs text-red-300"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
