"use client";

import { useState } from "react";
import Image from "next/image";
import { CelebrateOfferButton } from "@/components/site/CelebrateOfferButton";
import { launchNyFireworks, setNyFireworksPaused } from "@/lib/new-year-fireworks";
import type { PopupOffer as PopupType } from "@/lib/types";

type Dialog = "goals" | null;

export function NewYearHero({ popup = null }: { popup?: PopupType | null }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [paused, setPaused] = useState(false);

  return (
    <section id="new-year-hero" className="ny-hero" data-on-dark>
      <Image
        src="/festival/new-year-2027.jpg"
        alt=""
        fill
        priority
        className="ny-hero-photo"
        sizes="100vw"
      />
      <div className="ny-hero-shade" />
      <div className="ny-hero-glow" />
      <div className="ny-hero-copy">
        <p className="ny-kicker">New Year ✳ New Goals ✳ New Energy</p>
        <h1 className="ny-title">
          <span className="ny-celebrate">CELEBRATE</span>
          <span className="ny-again">Again.</span>
        </h1>
        <p className="ny-message">
          Fresh year. Fearless energy. A thousand new reasons to show up for yourself. Let&apos;s
          make 2027 unforgettable.
        </p>
        <div className="ny-actions">
          <CelebrateOfferButton
            popup={popup}
            fallback={{
              title: "Happy New Year 2027!",
              body: "New Year. New Goals. New Energy!\n\nWishing you happiness, good health, incredible achievements, and unstoppable strength.\n\nLet's make 2027 our strongest year yet!\n\nAction Plus Gym & Fitness Club",
            }}
          />
          <a href="#ny-experience" className="ny-btn ny-btn-ghost">
            Discover the vibe ↓
          </a>
        </div>
        <button
          type="button"
          className="ny-pill"
          onClick={() => {
            launchNyFireworks("short");
            setDialog("goals");
          }}
        >
          ✳ Your 2027 goals
        </button>
        <div className="ny-controls">
          <button type="button" className="ny-mini" onClick={() => launchNyFireworks("short")}>
            🎆 Launch fireworks
          </button>
          <button
            type="button"
            className="ny-mini"
            onClick={() => {
              const next = !paused;
              setPaused(next);
              setNyFireworksPaused(next);
            }}
          >
            {paused ? "▶ Resume effects" : "⏸ Pause effects"}
          </button>
        </div>
      </div>

      {dialog === "goals" ? (
        <div className="ny-dialog" role="dialog" aria-modal="true" aria-labelledby="ny-goals-title">
          <div className="ny-dialog-card">
            <button type="button" className="ny-dialog-close" onClick={() => setDialog(null)} aria-label="Close">
              ×
            </button>
            <h2 id="ny-goals-title">Your strongest year starts now</h2>
            <p>
              2027 is your year to dream bigger, push harder, stay consistent, and become stronger
              every day.
            </p>
            <p>New Year. New Goals. New Energy.</p>
            <p>— Action Plus Gym &amp; Fitness Club</p>
            <button type="button" className="ny-btn ny-btn-gold" onClick={() => setDialog(null)}>
              Let&apos;s go
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
