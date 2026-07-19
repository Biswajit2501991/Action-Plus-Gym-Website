"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Apple,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Heart,
  Sparkles,
  TrendingDown,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { ServiceItem } from "@/lib/types";

const AUTO_MS = 5000;

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  dumbbell: Dumbbell,
  users: Users,
  zap: Zap,
  "trending-down": TrendingDown,
  heart: Heart,
  activity: Activity,
  flame: Flame,
  apple: Apple,
  trophy: Trophy,
  sparkles: Sparkles,
};

export function Services({ services }: { services: ServiceItem[] }) {
  const slides = Array.isArray(services) ? services : [];
  const total = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || total <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [paused, total]);

  useEffect(() => {
    if (index >= total && total > 0) setIndex(0);
  }, [index, total]);

  if (total === 0) return null;

  const current = slides[index] ?? slides[0];
  const Icon = icons[current.icon] ?? Dumbbell;

  return (
    <section id="services" className="section-pad">
      <div className="container-site">
        <SectionHeading
          eyebrow="Services"
          title="Training built for ambition"
          subtitle="From strength floors to specialised coaching — every programme is designed for serious results."
        />

        <div
          className="relative mx-auto max-w-3xl"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <div className="relative min-h-[260px] overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-charcoal/80 to-black/60 px-8 py-10 md:min-h-[280px] md:px-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(201,162,39,0.12),transparent_45%)]" />

            <AnimatePresence mode="wait">
              <motion.article
                key={current.id ?? `${current.title}-${index}`}
                initial={{ opacity: 0, x: 36 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -36 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex min-h-[180px] flex-col justify-between md:min-h-[200px]"
              >
                <div>
                  <div className="mb-5 inline-flex rounded-2xl border border-gold/30 bg-gold/10 p-3.5 text-gold">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold/80">
                    Service {index + 1} of {total}
                  </p>
                  <h3 className="mt-3 font-display text-3xl text-white md:text-4xl">
                    {current.title}
                  </h3>
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">
                    {current.description}
                  </p>
                </div>
              </motion.article>
            </AnimatePresence>

            {/* Progress bar for the 2s hold */}
            {!paused && total > 1 ? (
              <motion.div
                key={`progress-${index}`}
                className="absolute bottom-0 left-0 h-[2px] bg-gold"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: AUTO_MS / 1000, ease: "linear" }}
              />
            ) : null}
          </div>

          {total > 1 ? (
            <>
              <div className="mt-5 flex items-center justify-between gap-4">
                <button
                  type="button"
                  aria-label="Previous service"
                  onClick={() => setIndex((i) => (i - 1 + total) % total)}
                  className="rounded-full border border-white/15 p-2 text-white/80 transition hover:border-gold hover:text-gold"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {slides.map((service, i) => (
                    <button
                      key={service.id ?? i}
                      type="button"
                      aria-label={`Show ${service.title}`}
                      onClick={() => setIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === index ? "w-7 bg-gold" : "w-1.5 bg-white/25"
                      }`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  aria-label="Next service"
                  onClick={() => setIndex((i) => (i + 1) % total)}
                  className="rounded-full border border-white/15 p-2 text-white/80 transition hover:border-gold hover:text-gold"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-3 text-center text-xs text-muted">
                Auto-advances every 5 seconds · hover to pause
              </p>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
