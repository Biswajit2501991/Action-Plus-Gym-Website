"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import type { PricingPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Pricing({ plans }: { plans: PricingPlan[] }) {
  return (
    <section id="pricing" className="section-pad bg-black/30">
      <div className="container-site">
        <SectionHeading
          eyebrow="Membership"
          title="Choose your membership"
          subtitle="Clear pricing. Premium access. Join when you are ready."
        />
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.article
              key={plan.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                "relative rounded-3xl border p-7",
                plan.is_featured
                  ? "border-gold/50 bg-gradient-to-b from-gold/15 to-charcoal"
                  : "border-white/10 bg-charcoal/50",
              )}
            >
              {plan.badge ? (
                <span className="absolute -top-3 left-6 rounded-full gold-gradient px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-black">
                  {plan.badge}
                </span>
              ) : null}
              <p className="text-sm uppercase tracking-[0.2em] text-muted">
                {plan.period}
              </p>
              <h3 className="mt-2 font-display text-2xl text-white">{plan.name}</h3>
              <p className="mt-4 font-display text-4xl text-gold">{plan.price}</p>
              <p className="mt-3 text-sm text-muted">{plan.description}</p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/85">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                href={`#join`}
                className="mt-8 w-full"
                variant={plan.is_featured ? "primary" : "secondary"}
              >
                {plan.cta_text || "Join Now"}
              </Button>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
