"use client";

import { useEffect, useRef } from "react";
import {
  HOLI_BLAST_EVENT,
  HOLI_PALETTE_EVENT,
  HOLI_PALETTES,
  HOLI_PAUSE_EVENT,
  type HoliBlastMode,
  type HoliPalette,
} from "@/lib/holi-effects";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  powder: boolean;
};

type Rocket = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetY: number;
  color: string;
  trail: { x: number; y: number }[];
};

function pick(colors: string[]) {
  return colors[Math.floor(Math.random() * colors.length)];
}

function burst(particles: Particle[], x: number, y: number, colors: string[], heavy: boolean) {
  const count = heavy ? 70 + Math.floor(Math.random() * 40) : 28;
  const color = pick(colors);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (heavy ? 1.4 : 0.7) + Math.random() * (heavy ? 3.8 : 2);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 1,
      max: 0.5 + Math.random() * 0.8,
      color,
      size: heavy ? 1.6 + Math.random() * 2.8 : 1 + Math.random(),
      powder: Math.random() > 0.35,
    });
  }
}

function launchRocket(rockets: Rocket[], colors: string[], full: boolean) {
  rockets.push({
    x: 40 + Math.random() * (window.innerWidth - 80),
    y: window.innerHeight + 8,
    vx: (Math.random() - 0.5) * 1.4,
    vy: full ? -(6.2 + Math.random() * 2.4) : -(4.4 + Math.random() * 1.5),
    targetY: window.innerHeight * (0.12 + Math.random() * 0.38),
    color: pick(colors),
    trail: [],
  });
}

export function HoliFireworks({
  idle = true,
  className = "festival-diwali-canvas",
}: {
  idle?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const mobile = window.innerWidth < 720;
    let colors = HOLI_PALETTES.festival;
    let raf = 0;
    let running = true;
    let paused = false;
    const particles: Particle[] = [];
    const rockets: Rocket[] = [];
    let lastIdle = 0;
    const idleGap = 7000;
    const cap = mobile ? 260 : 520;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const play = (mode: HoliBlastMode) => {
      if (paused || document.hidden) return;
      const n = mode === "grand" ? 8 : mode === "open" ? 3 : 4;
      for (let i = 0; i < n; i++) {
        window.setTimeout(() => launchRocket(rockets, colors, true), i * 160);
      }
    };

    const onBurst = (e: Event) => {
      play(((e as CustomEvent).detail?.mode || "short") as HoliBlastMode);
    };
    const onPause = (e: Event) => {
      paused = Boolean((e as CustomEvent).detail?.paused);
    };
    const onPalette = (e: Event) => {
      const next = (e as CustomEvent).detail?.palette as HoliPalette;
      if (next && HOLI_PALETTES[next]) colors = HOLI_PALETTES[next];
    };
    window.addEventListener(HOLI_BLAST_EVENT, onBurst);
    window.addEventListener(HOLI_PAUSE_EVENT, onPause);
    window.addEventListener(HOLI_PALETTE_EVENT, onPalette);

    window.setTimeout(() => play("open"), 500);

    const tick = (now: number) => {
      if (!running) return;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (!document.hidden && !paused) {
        if (idle && now - lastIdle > idleGap + Math.random() * 3000) {
          lastIdle = now;
          const n = 1 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) launchRocket(rockets, colors, false);
        }
        for (let i = rockets.length - 1; i >= 0; i--) {
          const r = rockets[i];
          r.x += r.vx;
          r.y += r.vy;
          r.vy += 0.016;
          r.trail.push({ x: r.x, y: r.y });
          if (r.trail.length > 16) r.trail.shift();
          ctx.beginPath();
          for (let t = 0; t < r.trail.length; t++) {
            const p = r.trail[t];
            ctx.strokeStyle = r.color;
            ctx.globalAlpha = (t / r.trail.length) * 0.7;
            ctx.lineWidth = 2.2;
            if (t === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(r.x, r.y, 2.6, 0, Math.PI * 2);
          ctx.fill();
          if (r.y <= r.targetY || r.vy >= -0.35) {
            burst(particles, r.x, r.y, colors, true);
            if (Math.random() > 0.45) burst(particles, r.x + 14, r.y + 10, colors, true);
            rockets.splice(i, 1);
          }
        }
        while (particles.length > cap) particles.shift();
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.powder ? 0.03 : 0.016;
          p.vx *= 0.99;
          p.life -= p.powder ? 0.008 : 0.013;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = Math.max(0, p.life / p.max) * (p.powder ? 0.55 : 0.9);
          ctx.fillStyle = p.color;
          if (p.powder) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 1.8, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener(HOLI_BLAST_EVENT, onBurst);
      window.removeEventListener(HOLI_PAUSE_EVENT, onPause);
      window.removeEventListener(HOLI_PALETTE_EVENT, onPalette);
    };
  }, [idle]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
