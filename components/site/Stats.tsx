"use client";

import { motion } from "framer-motion";
import type { StatItem } from "@/lib/types";

export function Stats({ stats }: { stats: StatItem[] }) {
  return (
    <section className="relative -mt-10 z-20 px-5 md:px-8">
      <div className="container-site">
        <div className="glass grid grid-cols-2 gap-px overflow-hidden rounded-3xl md:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="bg-bg-elevated/80 px-5 py-8 text-center"
            >
              <p className="font-display text-3xl text-gold md:text-4xl">
                {stat.value}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
