"use client";

import { motion } from "framer-motion";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { DAY_NAMES, formatTime } from "@/lib/utils";
import { getOpenStatus } from "@/lib/hours";
import type { OpeningHour } from "@/lib/types";

export function Hours({
  hours,
  timezone,
}: {
  hours: OpeningHour[];
  timezone: string;
}) {
  const status = getOpenStatus(hours, timezone);
  const ordered = [...hours]
    .filter((h) => !h.is_hidden)
    .sort((a, b) => {
      const aa = a.day_of_week === 0 ? 7 : a.day_of_week;
      const bb = b.day_of_week === 0 ? 7 : b.day_of_week;
      return aa - bb;
    });

  return (
    <section id="hours" className="section-pad">
      <div className="container-site">
        <SectionHeading
          eyebrow="Hours"
          title="Train on your schedule"
          subtitle="Check when we are open and walk in ready to work."
        />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-charcoal/50"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <p className="text-sm uppercase tracking-[0.2em] text-muted">
              Opening Hours
            </p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                status.isOpen
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-white/10 text-white/70"
              }`}
            >
              {status.label}
            </span>
          </div>
          <ul>
            {ordered.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between border-b border-white/5 px-6 py-4 text-sm last:border-0"
              >
                <span className="text-white">{DAY_NAMES[h.day_of_week]}</span>
                <span className="text-muted">
                  {h.is_closed
                    ? "Closed"
                    : `${formatTime(h.open_time)} – ${formatTime(h.close_time)}`}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
