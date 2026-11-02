"use client";

import { useEffect, useState } from "react";
import { launchNyFireworks } from "@/lib/new-year-fireworks";

const MIDNIGHT = new Date("2027-01-01T00:00:00+05:30").getTime();

function parts(ms: number) {
  const safe = Math.max(0, ms);
  return {
    days: Math.floor(safe / 86400000),
    hours: Math.floor((safe % 86400000) / 3600000),
    minutes: Math.floor((safe % 3600000) / 60000),
    seconds: Math.floor((safe % 60000) / 1000),
  };
}

export function NewYearStory() {
  const [left, setLeft] = useState(() => Math.max(0, MIDNIGHT - Date.now()));
  const arrived = left <= 0;
  const p = parts(left);

  useEffect(() => {
    const id = window.setInterval(() => setLeft(Math.max(0, MIDNIGHT - Date.now())), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!arrived) return;
    try {
      if (sessionStorage.getItem("apg-ny-midnight") === "1") return;
      sessionStorage.setItem("apg-ny-midnight", "1");
    } catch {
      /* ignore */
    }
    launchNyFireworks("grand");
  }, [arrived]);

  return (
    <>
      <section id="ny-experience" className="ny-block ny-experience">
        <p className="ny-block-kicker">{arrived ? "🎆 2027 is here — let’s celebrate! 🎆" : "The countdown is on"}</p>
        {!arrived ? (
          <>
            <p className="ny-block-sub">Midnight magic starts in ✧</p>
            <div className="ny-count">
              {(
                [
                  ["Days", p.days],
                  ["Hours", p.hours],
                  ["Minutes", p.minutes],
                  ["Seconds", p.seconds],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="ny-count-cell">
                  <strong>{String(value).padStart(2, "0")}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
        <h2 className="ny-block-title">This year, we rise.</h2>
        <p className="ny-block-copy">
          A fresh beginning deserves an extraordinary feeling. Here&apos;s to positive energy, good
          company, and showing up stronger than yesterday.
        </p>
        <div className="ny-cards">
          <article className="ny-card">
            <p>01 — Dream bigger 🎯</p>
            <h3>Every goal begins with one bold first step.</h3>
          </article>
          <article className="ny-card">
            <p>02 — Feel the fire ⚡</p>
            <h3>Keep the momentum. Bring the energy.</h3>
          </article>
          <article className="ny-card">
            <p>03 — Celebrate more ✨</p>
            <h3>Small wins, big smiles, better together.</h3>
          </article>
        </div>
      </section>

      <section className="ny-block ny-fire">
        <h2 className="ny-block-title">
          Not just a new year.
          <br />
          A new fire.
        </h2>
        <p className="ny-block-copy">
          2027 is a blank page. Fill it with brave beginnings, unstoppable determination, and
          moments worth celebrating.
          <br />
          Your journey is yours. We&apos;re cheering you on.
        </p>
        <p className="ny-quote">Stronger minds. Stronger bodies. Brighter days ahead.</p>
        <button type="button" className="ny-btn ny-btn-gold" onClick={() => launchNyFireworks("short")}>
          Make a little magic ↗
        </button>
      </section>

      <section className="ny-block ny-finale">
        <h2 className="ny-block-title ny-finale-title">
          Let&apos;s make
          <span className="ny-year">2027</span>
          legendary.
        </h2>
        <p className="ny-block-copy">
          Wishing you and your family a year filled with health, happiness, success, and powerful new
          beginnings.
        </p>
        <button type="button" className="ny-btn ny-btn-gold" onClick={() => launchNyFireworks("grand")}>
          Launch the fireworks ✦
        </button>
        <p className="ny-close">Cheers to all that lies ahead! 🥂</p>
        <p className="ny-close-brand">With love from Action Plus Gym &amp; Fitness Club, Adra.</p>
      </section>
    </>
  );
}
