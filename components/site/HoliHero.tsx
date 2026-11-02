"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CelebrateOfferButton } from "@/components/site/CelebrateOfferButton";
import { launchHoliBlast, setHoliEffectsPaused } from "@/lib/holi-effects";
import type { PopupOffer as PopupType } from "@/lib/types";

export function HoliHero({ popup = null }: { popup?: PopupType | null }) {
  const [paused, setPaused] = useState(false);
  const [hiddenBar, setHiddenBar] = useState(false);
  const [glow, setGlow] = useState(false);

  useEffect(() => {
    const onScroll = () => setHiddenBar(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function blast() {
    setGlow(true);
    launchHoliBlast("grand");
    window.setTimeout(() => setGlow(false), 1400);
  }

  return (
    <section id="holi-hero" className="holi-hero" data-on-dark>
      <Image
        src="/festival/holi-2027.jpg"
        alt=""
        fill
        priority
        className="holi-hero-photo"
        sizes="100vw"
      />
      <div className="holi-hero-shade" />
      <p className={`holi-ticker${hiddenBar ? " is-hidden" : ""}`}>
        ✦ Happy Holi 2027 ✦ Celebrate colour, strength &amp; new energy ✦
      </p>
      <div className={`holi-hero-copy${glow ? " is-glow" : ""}`}>
        <p className="holi-kicker">Action Plus Gym &amp; Fitness Club</p>
        <h1 className="holi-title">
          Happy Holi 2027
          <span className="holi-year">Unleash your colour.</span>
        </h1>
        <p className="holi-message">
          This Holi, turn up the energy. Train harder, shine brighter, and celebrate every shade of
          strength.
        </p>
        <p className="holi-slogan">New colours · New energy · Same unstoppable you</p>
        <div className="holi-actions">
          <CelebrateOfferButton
            popup={popup}
            fallback={{
              title: "Happy Holi 2027",
              body: "Celebrate colour, strength and new energy at Action Plus Gym.",
            }}
          />
          <button type="button" className="holi-btn holi-btn-neon" onClick={blast}>
            ✳ Let the colours fly
          </button>
          <a href="#holi-experience" className="holi-btn holi-btn-ghost">
            Explore the vibe ↗
          </a>
          <a href="#join" className="holi-btn holi-btn-ghost">
            Join the energy ↗
          </a>
        </div>
        <div className="holi-controls">
          <button
            type="button"
            className="holi-mini"
            onClick={() => {
              const next = !paused;
              setPaused(next);
              setHoliEffectsPaused(next);
            }}
          >
            {paused ? "▶ Auto effects on" : "⏸ Auto effects off"}
          </button>
        </div>
      </div>
    </section>
  );
}
