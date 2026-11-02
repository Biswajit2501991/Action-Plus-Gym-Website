"use client";

import { useEffect, useRef } from "react";
import {
  NY_FIREWORKS_EVENT,
  NY_PAUSE_EVENT,
  type NyFireworksMode,
} from "@/lib/new-year-fireworks";

const COLORS = ["#f4d38a", "#ff6b6b", "#4da3ff", "#c084fc", "#fb923c", "#f472b6", "#34d399"];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  spark: boolean;
  confetti: boolean;
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

function burst(particles: Particle[], x: number, y: number, full: boolean) {
  const count = full ? 56 + Math.floor(Math.random() * 30) : 22;
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const star = Math.random() > 0.4;
  for (let i = 0; i < count; i++) {
    const a = star ? (i / count) * Math.PI * 2 : Math.random() * Math.PI * 2;
    const sp = (full ? 1.8 : 0.9) + Math.random() * (full ? 3.6 : 1.8);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 1,
      max: 0.55 + Math.random() * 0.7,
      color,
      size: full ? 1.5 + Math.random() * 2.2 : 1 + Math.random(),
      spark: Math.random() > 0.65,
      confetti: false,
    });
  }
}

function confetti(particles: Particle[], amount: number) {
  for (let i = 0; i < amount; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: -10 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 2.4,
      vy: 1.2 + Math.random() * 2.2,
      life: 1,
      max: 1.4 + Math.random(),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 2 + Math.random() * 2.4,
      spark: false,
      confetti: true,
    });
  }
}

function launchRocket(rockets: Rocket[], full: boolean) {
  rockets.push({
    x: 40 + Math.random() * (window.innerWidth - 80),
    y: window.innerHeight + 8,
    vx: (Math.random() - 0.5) * 1.2,
    vy: full ? -(6.4 + Math.random() * 2.6) : -(4.6 + Math.random() * 1.6),
    targetY: window.innerHeight * (full ? 0.1 + Math.random() * 0.36 : 0.18 + Math.random() * 0.28),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    trail: [],
  });
}

export function NewYearFireworks({ idle = true }: { idle?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let paused = false;
    const particles: Particle[] = [];
    const rockets: Rocket[] = [];
    let lastIdle = 0;
    const idleGap = 4200;

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

    const play = (mode: NyFireworksMode) => {
      if (paused || document.hidden) return;
      const n = mode === "grand" ? 7 : mode === "open" ? 4 : 3;
      for (let i = 0; i < n; i++) {
        window.setTimeout(() => launchRocket(rockets, true), i * 180);
      }
      confetti(particles, mode === "grand" ? 70 : 36);
    };

    const onBurst = (e: Event) => {
      const mode = ((e as CustomEvent).detail?.mode || "short") as NyFireworksMode;
      play(mode);
    };
    const onPause = (e: Event) => {
      paused = Boolean((e as CustomEvent).detail?.paused);
    };
    window.addEventListener(NY_FIREWORKS_EVENT, onBurst);
    window.addEventListener(NY_PAUSE_EVENT, onPause);

    window.setTimeout(() => play("open"), 400);

    const tick = (now: number) => {
      if (!running) return;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (!document.hidden && !paused) {
        if (idle && now - lastIdle > idleGap + Math.random() * 2200) {
          lastIdle = now;
          launchRocket(rockets, false);
        }
        for (let i = rockets.length - 1; i >= 0; i--) {
          const r = rockets[i];
          r.x += r.vx;
          r.y += r.vy;
          r.vy += 0.018;
          r.trail.push({ x: r.x, y: r.y });
          if (r.trail.length > 14) r.trail.shift();
          ctx.beginPath();
          for (let t = 0; t < r.trail.length; t++) {
            const p = r.trail[t];
            ctx.strokeStyle = r.color;
            ctx.globalAlpha = (t / r.trail.length) * 0.55;
            ctx.lineWidth = 1.6;
            if (t === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#fff6c8";
          ctx.beginPath();
          ctx.arc(r.x, r.y, 2.4, 0, Math.PI * 2);
          ctx.fill();
          if (r.y <= r.targetY || r.vy >= -0.4) {
            burst(particles, r.x, r.y, true);
            if (Math.random() > 0.5) burst(particles, r.x + 18, r.y + 8, true);
            rockets.splice(i, 1);
          }
        }
        while (particles.length > 520) particles.shift();
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.confetti ? 0.04 : 0.018;
          p.vx *= 0.992;
          p.life -= p.confetti ? 0.006 : 0.012;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = Math.max(0, p.life / p.max);
          ctx.fillStyle = p.color;
          if (p.confetti) ctx.fillRect(p.x, p.y, p.size, p.size * 0.45);
          else if (p.spark) {
            ctx.fillRect(p.x, p.y, p.size * 1.6, p.size * 0.5);
            ctx.fillRect(p.x, p.y, p.size * 0.5, p.size * 1.6);
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
      window.removeEventListener(NY_FIREWORKS_EVENT, onBurst);
      window.removeEventListener(NY_PAUSE_EVENT, onPause);
    };
  }, [idle]);

  return <canvas ref={canvasRef} className="festival-diwali-canvas" aria-hidden />;
}
