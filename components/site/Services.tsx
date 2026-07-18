"use client";

import { motion } from "framer-motion";
import {
  Activity,
  Apple,
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
  return (
    <section id="services" className="section-pad">
      <div className="container-site">
        <SectionHeading
          eyebrow="Services"
          title="Training built for ambition"
          subtitle="From strength floors to specialised coaching — every programme is designed for serious results."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => {
            const Icon = icons[service.icon] ?? Dumbbell;
            return (
              <motion.article
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: (i % 3) * 0.06, duration: 0.45 }}
                className="group rounded-3xl border border-white/8 bg-charcoal/60 p-6 transition hover:border-gold/35"
              >
                <div className="mb-4 inline-flex rounded-2xl border border-gold/25 bg-gold/10 p-3 text-gold">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-xl text-white">{service.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {service.description}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
