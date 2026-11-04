"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Transformation } from "@/lib/types";

const ALLOWED_HOSTS = new Set([
  "oddggoiyckyxolmqqjrf.supabase.co",
  "images.unsplash.com",
]);

function allowedHost(src: string) {
  try {
    return ALLOWED_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

function JourneyPhoto({ src, alt }: { src: string; alt: string }) {
  if (allowedHost(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 50vw, 320px"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
  );
}

function PhotoFrame({
  src,
  alt,
  label,
}: {
  src: string;
  alt: string;
  label: string;
}) {
  if (!src) return null;
  return (
    <figure className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-black/40">
      <JourneyPhoto src={src} alt={alt} />
      <figcaption className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
        {label}
      </figcaption>
    </figure>
  );
}

export function Transformations({ items }: { items: Transformation[] }) {
  if (!items.length) return null;

  return (
    <section id="transformations" className="section-pad bg-black/30">
      <div className="container-site">
        <SectionHeading
          eyebrow="Transformation Journey"
          title="Real progress, trained here"
          subtitle="Members who put in the work, and the coaches who guided them."
        />
        <div className="grid gap-6 md:grid-cols-2">
          {items.map((item, i) => {
            const photoCount = [item.before_photo_url, item.after_photo_url].filter(
              Boolean,
            ).length;
            return (
              <motion.article
                key={item.id ?? `${item.member_name}-${i}`}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 4) * 0.06 }}
                className="rounded-3xl border border-white/10 bg-charcoal/50 p-4 md:p-5"
              >
                <div className={photoCount > 1 ? "grid grid-cols-2 gap-3" : "grid"}>
                  <PhotoFrame
                    src={item.before_photo_url}
                    alt={`${item.member_name} before`}
                    label="Before"
                  />
                  <PhotoFrame
                    src={item.after_photo_url}
                    alt={`${item.member_name} after`}
                    label="After"
                  />
                </div>
                {item.photo_message ? (
                  <p className="mt-4 text-sm font-medium text-gold">{item.photo_message}</p>
                ) : null}
                {item.message ? (
                  <p className="mt-3 text-sm leading-relaxed text-white/85">{item.message}</p>
                ) : null}
                <footer className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-xl text-white">{item.member_name}</p>
                  {item.trained_under ? (
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">
                      Trained under{" "}
                      <span className="text-white">{item.trained_under}</span>
                    </p>
                  ) : null}
                </footer>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
