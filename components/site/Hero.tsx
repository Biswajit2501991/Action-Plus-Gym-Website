"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import type { HeroSlide, WebsiteSettings } from "@/lib/types";

export function Hero({
  settings,
  slides,
}: {
  settings: WebsiteSettings;
  slides: HeroSlide[];
}) {
  const safeSlides = slides.filter((s) => Boolean(s?.image_url));
  const [index, setIndex] = useState(0);
  const active = safeSlides[index] ?? safeSlides[0];

  useEffect(() => {
    if (safeSlides.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % safeSlides.length);
    }, 6000);
    return () => clearInterval(id);
  }, [safeSlides.length]);

  return (
    <section className="relative min-h-[100svh] overflow-hidden">
      <AnimatePresence mode="wait">
        {active?.image_url ? (
          <motion.div
            key={active.id + active.image_url}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <Image
              src={active.image_url}
              alt={active.title || settings.site_name}
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
          </motion.div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-black via-[#1a1408] to-black" />
        )}
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(201,162,39,0.18),transparent_45%)]" />

      <div className="relative z-10 flex min-h-[100svh] items-end pb-20 pt-32 md:items-center md:pb-0">
        <div className="container-site px-5 md:px-8">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7 }}
            className="font-display text-4xl text-gold-gradient sm:text-5xl md:text-7xl lg:text-8xl"
          >
            {settings.site_name}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="mt-4 max-w-3xl font-display text-2xl text-white md:text-4xl"
          >
            {settings.hero_headline}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.7 }}
            className="mt-4 max-w-xl text-base text-white/75 md:text-lg"
          >
            {settings.hero_subheadline}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Button href="#join">Join Now</Button>
            <Button href="#join" variant="secondary">
              Book a Free Trial
            </Button>
            <Button href="/contact" variant="ghost">
              Contact Us
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
