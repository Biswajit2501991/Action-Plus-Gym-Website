"use client";

import { useState } from "react";
import { launchHoliBlast, setHoliPalette, type HoliPalette } from "@/lib/holi-effects";

const PALETTES: { id: HoliPalette; label: string; hint: string }[] = [
  { id: "festival", label: "Festival Mix", hint: "Pink, cyan, yellow, purple, orange" },
  { id: "neon", label: "Neon Glow", hint: "Lime, electric blue, purple, pink" },
  { id: "sunset", label: "Sunset Rush", hint: "Orange, yellow, hot pink, magenta" },
];

export function HoliStory() {
  const [palette, setPalette] = useState<HoliPalette>("festival");

  return (
    <>
      <section id="holi-experience" className="holi-block holi-experience">
        <p className="holi-block-kicker">Colour. Strength. Celebration.</p>
        <h2 className="holi-block-title">This Holi, we train in every shade.</h2>
        <p className="holi-block-copy">
          Powder in the air. Power on the floor. Action Plus Gym celebrates Holi 2027 with energy,
          colour, and the same unstoppable you.
        </p>
        <div className="holi-cards">
          <article className="holi-card">
            <p>01 — Colour up</p>
            <h3>Bring the blast. Keep the form.</h3>
          </article>
          <article className="holi-card">
            <p>02 — Train harder</p>
            <h3>Every rep is a brighter shade of progress.</h3>
          </article>
          <article className="holi-card">
            <p>03 — Celebrate</p>
            <h3>New colours. New energy. Same family.</h3>
          </article>
        </div>
      </section>

      <section className="holi-block holi-mixer">
        <h2 className="holi-block-title">Pick your colour blast</h2>
        <p className="holi-block-copy">Changes rockets and powder only. Nothing is saved to the gym.</p>
        <div className="holi-palettes">
          {PALETTES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`holi-palette${palette === item.id ? " is-on" : ""}`}
              onClick={() => {
                setPalette(item.id);
                setHoliPalette(item.id);
                launchHoliBlast("short");
              }}
            >
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </button>
          ))}
        </div>
        <button type="button" className="holi-btn holi-btn-neon" onClick={() => launchHoliBlast("grand")}>
          ✳ Let the colours fly
        </button>
      </section>
    </>
  );
}
