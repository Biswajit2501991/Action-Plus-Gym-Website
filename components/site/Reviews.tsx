"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import type { ReviewCache } from "@/lib/types";

export function Reviews({ reviews }: { reviews: ReviewCache }) {
  return (
    <section id="reviews" className="section-pad bg-black/25">
      <div className="container-site">
        <SectionHeading
          eyebrow="Google Reviews"
          title="Trusted by the community"
          subtitle="See what members are saying about Action Plus Gym."
        />

        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <p className="font-display text-5xl text-gold">{reviews.overall_rating}</p>
          <div className="flex gap-1 text-gold">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-current" />
            ))}
          </div>
          <p className="text-sm text-muted">
            Based on {reviews.total_reviews}+ Google reviews
          </p>
          <Button
            href={reviews.google_url || "https://www.google.com/maps"}
            variant="secondary"
          >
            View All Google Reviews
          </Button>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {reviews.reviews.slice(0, 6).map((r, i) => (
            <motion.article
              key={`${r.author}-${i}`}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-3xl border border-white/10 bg-charcoal/50 p-6"
            >
              <div className="mb-3 flex gap-1 text-gold">
                {Array.from({ length: r.rating || 5 }).map((_, idx) => (
                  <Star key={idx} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-white/85">“{r.text}”</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{r.author}</p>
                  {r.relative_time ? (
                    <p className="text-xs text-muted">{r.relative_time}</p>
                  ) : null}
                </div>
                <a
                  href={reviews.google_url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-gold hover:underline"
                >
                  Read More on Google
                </a>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
