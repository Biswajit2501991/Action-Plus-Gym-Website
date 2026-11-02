"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { launchNyFireworks, setNyFireworksPaused } from "@/lib/new-year-fireworks";

type Dialog = "celebrate" | "goals" | null;

export function NewYearHero() {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [paused, setPaused] = useState(false);
  const [glow, setGlow] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("apg-ny-welcome") === "1") return;
      sessionStorage.setItem("apg-ny-welcome", "1");
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => setDialog("celebrate"), 900);
    return () => window.clearTimeout(t);
  }, []);

  function celebrate() {
    setGlow(true);
    launchNyFireworks("grand");
    setDialog("celebrate");
    window.setTimeout(() => setGlow(false), 1600);
  }

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
      <div className={`ny-hero-copy${glow ? " is-glow" : ""}`}>
        <p className="ny-kicker">Action Plus Gym &amp; Fitness Club</p>
        <p className="ny-eyebrow">A new chapter is calling — Action Plus Gym</p>
        <p className="ny-sub">Here&apos;s to a stronger you</p>
        <h1 className="ny-title">
          Happy New Year
          <span className="ny-year">2027</span>
        </h1>
        <p className="ny-message">
          More strength. More smiles. More reasons to celebrate.
          <br />
          Let&apos;s make every rep, every day, and every victory count.
        </p>
        <div className="ny-actions">
          <button type="button" className="ny-btn ny-btn-gold" onClick={celebrate}>
            Let&apos;s celebrate ↗
          </button>
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
          ✳ New Year · New Goals · New Energy
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

      {dialog === "celebrate" ? (
        <div className="ny-dialog" role="dialog" aria-modal="true" aria-labelledby="ny-greet-title">
          <div className="ny-dialog-card">
            <button type="button" className="ny-dialog-close" onClick={() => setDialog(null)} aria-label="Close">
              ×
            </button>
            <h2 id="ny-greet-title">🎊 Happy New Year 2027! 🎊</h2>
            <p>New Year. New Strength. New Possibilities!</p>
            <p>
              May 2027 bring you happiness, good health, unstoppable motivation, and amazing
              achievements.
            </p>
            <p>
              Let&apos;s grow stronger, smile brighter, and celebrate every victory together!
            </p>
            <p>
              With love,
              <br />
              Action Plus Gym &amp; Fitness Club 💪✨
            </p>
            <button type="button" className="ny-btn ny-btn-gold" onClick={celebrate}>
              Celebrate again 🎆
            </button>
          </div>
        </div>
      ) : null}

      {dialog === "goals" ? (
        <div className="ny-dialog" role="dialog" aria-modal="true" aria-labelledby="ny-goals-title">
          <div className="ny-dialog-card">
            <button type="button" className="ny-dialog-close" onClick={() => setDialog(null)} aria-label="Close">
              ×
            </button>
            <h2 id="ny-goals-title">💪 Your strongest year starts now!</h2>
            <p>
              2027 is your year to dream bigger, push harder, stay consistent, and become stronger
              every day.
            </p>
            <p>New Year. New Goals. New Energy.</p>
            <p>Every rep matters. Every effort counts. Every victory deserves celebration.</p>
            <p>Let&apos;s make 2027 legendary together!</p>
            <p>— Action Plus Gym &amp; Fitness Club ✨</p>
            <button type="button" className="ny-btn ny-btn-gold" onClick={() => setDialog(null)}>
              Let&apos;s go! 💪
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
