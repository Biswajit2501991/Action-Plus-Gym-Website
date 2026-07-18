"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Trainer } from "@/lib/types";

export function Trainers({ trainers }: { trainers: Trainer[] }) {
  return (
    <section id="trainers" className="section-pad">
      <div className="container-site">
        <SectionHeading
          eyebrow="Trainers"
          title="Coaches who raise the standard"
          subtitle="Experienced specialists dedicated to technique, progress, and accountability."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {trainers.map((trainer, i) => (
            <motion.article
              key={trainer.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="overflow-hidden rounded-3xl border border-white/10 bg-charcoal/40"
            >
              <div className="relative aspect-[4/5]">
                <Image
                  src={trainer.photo_url}
                  alt={trainer.name}
                  fill
                  className="object-cover"
                  sizes="(max-width:768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="font-display text-2xl text-white">{trainer.name}</h3>
                  <p className="mt-1 text-sm text-gold">{trainer.specialization}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-white/60">
                    {trainer.experience} experience
                  </p>
                  <p className="mt-3 text-sm text-white/75">{trainer.bio}</p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
