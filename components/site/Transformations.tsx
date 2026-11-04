"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Transformation } from "@/lib/types";

const AUTO_MS = 5200;

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

function JourneyPhoto({
  src,
  alt,
  sizes,
}: {
  src: string;
  alt: string;
  sizes: string;
}) {
  if (allowedHost(src)) {
    return <Image src={src} alt={alt} fill className="object-cover" sizes={sizes} />;
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
  sizes,
}: {
  src: string;
  alt: string;
  label: string;
  sizes: string;
}) {
  if (!src) return null;
  return (
    <figure className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-black/40">
      <JourneyPhoto src={src} alt={alt} sizes={sizes} />
      <figcaption className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
        {label}
      </figcaption>
    </figure>
  );
}

function JourneyCard({
  item,
  showMessage,
}: {
  item: Transformation;
  showMessage: boolean;
}) {
  const photoCount = [item.before_photo_url, item.after_photo_url].filter(Boolean).length;
  return (
    <>
      <div className={photoCount > 1 ? "grid grid-cols-2 gap-3" : "grid"}>
        <PhotoFrame
          src={item.before_photo_url}
          alt={`${item.member_name} before`}
          label="Before"
          sizes="(max-width: 768px) 45vw, 360px"
        />
        <PhotoFrame
          src={item.after_photo_url}
          alt={`${item.member_name} after`}
          label="After"
          sizes="(max-width: 768px) 45vw, 360px"
        />
      </div>
      {item.photo_message ? (
        <p className="mt-4 text-sm font-medium text-gold">{item.photo_message}</p>
      ) : null}
      {showMessage && item.message ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/85">
          {item.message}
        </p>
      ) : null}
      <footer className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-xl text-white">{item.member_name}</p>
        {item.trained_under ? (
          <p className="text-xs uppercase tracking-[0.16em] text-muted">
            Trained under <span className="text-white">{item.trained_under}</span>
          </p>
        ) : null}
      </footer>
    </>
  );
}

function JourneyDialog({
  item,
  onClose,
}: {
  item: Transformation;
  onClose: () => void;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="journey-dialog-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[min(90vh,52rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-charcoal p-4 shadow-2xl md:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white"
          aria-label="Close story"
        >
          <X className="h-4 w-4" />
        </button>
        <JourneyCard item={item} showMessage />
        <h2 id="journey-dialog-title" className="sr-only">
          {item.member_name} transformation
        </h2>
      </div>
    </div>,
    document.body,
  );
}

export function Transformations({ items }: { items: Transformation[] }) {
  const slides = Array.isArray(items) ? items : [];
  const total = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [open, setOpen] = useState<Transformation | null>(null);
  const closeDialog = useCallback(() => setOpen(null), []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (index < total) return;
    setIndex(0);
  }, [index, total]);

  useEffect(() => {
    if (paused || reduceMotion || open || total <= 1) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % total);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [paused, reduceMotion, open, total]);

  if (!total) return null;

  const current = slides[Math.min(index, total - 1)];
  const sliding = total > 1;

  return (
    <section id="transformations" className="section-pad bg-black/30">
      <div className="container-site">
        <SectionHeading
          eyebrow="Transformation Journey"
          title="Real progress, trained here"
          subtitle="Members who put in the work, and the coaches who guided them."
        />
        <div
          className="relative mx-auto max-w-3xl"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-charcoal/50 p-4 md:p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id ?? `${current.member_name}-${index}`}
                initial={sliding ? { opacity: 0, x: 36 } : false}
                animate={{ opacity: 1, x: 0 }}
                exit={sliding ? { opacity: 0, x: -36 } : undefined}
                transition={{ duration: 0.35 }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpen(current)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setOpen(current);
                  }}
                  className="cursor-pointer text-left"
                >
                  <JourneyCard item={current} showMessage={!sliding} />
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(current)}
                  className="mt-4 rounded-full border border-gold/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gold"
                >
                  View full story
                </button>
              </motion.div>
            </AnimatePresence>
          </div>

          {sliding ? (
            <div className="mt-5 flex items-center justify-between gap-4">
              <button
                type="button"
                aria-label="Previous journey"
                onClick={() => setIndex((currentIndex) => (currentIndex - 1 + total) % total)}
                className="rounded-full border border-white/15 p-2 text-white/80 transition hover:border-gold hover:text-gold"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {slides.map((item, dot) => (
                  <button
                    key={item.id ?? `${item.member_name}-${dot}`}
                    type="button"
                    aria-label={`${item.member_name}, journey ${dot + 1}`}
                    onClick={() => setIndex(dot)}
                    className={`h-1.5 rounded-full transition-all ${
                      dot === index ? "w-7 bg-gold" : "w-1.5 bg-white/25"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label="Next journey"
                onClick={() => setIndex((currentIndex) => (currentIndex + 1) % total)}
                className="rounded-full border border-white/15 p-2 text-white/80 transition hover:border-gold hover:text-gold"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {open ? <JourneyDialog item={open} onClose={closeDialog} /> : null}
    </section>
  );
}
