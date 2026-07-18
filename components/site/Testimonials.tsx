"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Testimonial } from "@/lib/types";

export function Testimonials({ items }: { items: Testimonial[] }) {
  return (
    <section id="testimonials" className="section-pad bg-black/20">
      <div className="container-site">
        <SectionHeading
          eyebrow="Testimonials"
          title="Members who raised their standard"
          subtitle="Real stories from people training at Action Plus."
        />
        <div className="grid gap-5 md:grid-cols-3">
          {items.map((item, i) => (
            <motion.blockquote
              key={item.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-3xl border border-white/10 bg-charcoal/50 p-6"
            >
              <div className="mb-4 flex gap-1 text-gold">
                {Array.from({ length: Math.round(item.rating || 5) }).map((_, idx) => (
                  <Star key={idx} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-white/85">“{item.quote}”</p>
              <footer className="mt-5 flex items-center gap-3">
                {item.photo_url ? (
                  <div className="relative h-10 w-10 overflow-hidden rounded-full">
                    <Image src={item.photo_url} alt={item.name} fill className="object-cover" />
                  </div>
                ) : null}
                <cite className="not-italic text-sm font-medium text-white">
                  {item.name}
                </cite>
              </footer>
            </motion.blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
