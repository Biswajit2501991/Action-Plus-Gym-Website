"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import type { ReviewCache } from "@/lib/types";

const AUTO_MS = 5200;

export function Reviews({ reviews }: { reviews: ReviewCache }) {
  const slides = (Array.isArray(reviews.reviews) ? reviews.reviews : []).slice(
    0,
    10,
  );
  // Final slide index = slides.length (CTA after the last review)
  const total = slides.length + 1;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || total <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [paused, total]);

  const googleUrl =
    reviews.google_url ||
    "https://www.google.com/search?q=Action+Plus+Gym+and+Fitness+Club+Reviews";

  const isCta = index >= slides.length;
  const current = !isCta ? slides[index] : null;

  return (
    <section id="reviews" className="section-pad bg-black/25">
      <div className="container-site">
        <SectionHeading
          eyebrow="Google Reviews"
          title="Trusted by the community"
          subtitle="Top live reviews from Google — swipe through, then open the full listing."
        />

        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <p className="font-display text-5xl text-gold">
            {reviews.overall_rating}
          </p>
          <div className="flex gap-1 text-gold">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-current" />
            ))}
          </div>
          <p className="text-sm text-muted">
            Based on {reviews.total_reviews}+ Google reviews
          </p>
        </div>

        <div
          className="relative mx-auto max-w-3xl"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <div className="relative min-h-[280px] overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-charcoal/80 to-black/60 px-8 py-10 md:px-12">
            <AnimatePresence mode="wait">
              {isCta ? (
                <motion.div
                  key="cta"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.35 }}
                  className="flex min-h-[200px] flex-col items-center justify-center gap-5 text-center"
                >
                  <p className="font-display text-3xl text-white md:text-4xl">
                    Want to read more?
                  </p>
                  <p className="max-w-md text-sm text-muted">
                    See every member review for Action Plus Gym on Google.
                  </p>
                  <Button href={googleUrl} variant="primary">
                    Check Google Reviews
                  </Button>
                </motion.div>
              ) : current ? (
                <motion.article
                  key={`${current.author}-${index}`}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.35 }}
                  className="flex min-h-[200px] flex-col justify-between"
                >
                  <div>
                    <div className="mb-4 flex gap-1 text-gold">
                      {Array.from({ length: current.rating || 5 }).map((_, idx) => (
                        <Star key={idx} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <p className="font-display text-xl leading-relaxed text-white md:text-2xl">
                      “{current.text}”
                    </p>
                  </div>
                  <div className="mt-8 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {current.author}
                      </p>
                      {current.relative_time ? (
                        <p className="text-xs text-muted">
                          {current.relative_time}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-xs uppercase tracking-[0.2em] text-gold/80">
                      Google
                    </span>
                  </div>
                </motion.article>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <button
              type="button"
              aria-label="Previous review"
              onClick={() => setIndex((i) => (i - 1 + total) % total)}
              className="rounded-full border border-white/15 p-2 text-white/80 transition hover:border-gold hover:text-gold"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {Array.from({ length: total }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={
                    i === slides.length
                      ? "Check Google Reviews slide"
                      : `Review ${i + 1}`
                  }
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index
                      ? "w-7 bg-gold"
                      : i === slides.length
                        ? "w-4 bg-gold/40"
                        : "w-1.5 bg-white/25"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              aria-label="Next review"
              onClick={() => setIndex((i) => (i + 1) % total)}
              className="rounded-full border border-white/15 p-2 text-white/80 transition hover:border-gold hover:text-gold"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <p className="mt-3 text-center text-xs text-muted">
            {isCta
              ? "Google reviews"
              : `${index + 1} / ${slides.length} · next: Check Google Reviews`}
          </p>
        </div>
      </div>
    </section>
  );
}
