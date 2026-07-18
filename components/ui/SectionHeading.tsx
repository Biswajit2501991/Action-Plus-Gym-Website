"use client";

import { motion } from "framer-motion";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="mx-auto mb-12 max-w-2xl text-center"
    >
      {eyebrow ? (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-gold">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-display text-3xl text-white md:text-5xl">{title}</h2>
      {subtitle ? (
        <p className="mt-4 text-base leading-relaxed text-muted md:text-lg">
          {subtitle}
        </p>
      ) : null}
    </motion.div>
  );
}
