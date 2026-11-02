"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const COLORS = ["#f4d38a", "#fb923c", "#f472b6", "#c084fc", "#4da3ff", "#34d399"];

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
  spin: number;
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

function burst(particles: Particle[], x: number, y: number, mobile: boolean) {
  const count = mobile ? 40 + Math.floor(Math.random() * 20) : 70 + Math.floor(Math.random() * 30);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const star = Math.random() > 0.35;
  for (let i = 0; i < count; i++) {
    const a = star ? (i / count) * Math.PI * 2 : Math.random() * Math.PI * 2;
    const sp = 1.6 + Math.random() * 3.4;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 1,
      max: 0.55 + Math.random() * 0.7,
      color: Math.random() > 0.55 ? color : COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 1.4 + Math.random() * 2.2,
      spark: Math.random() > 0.62,
      confetti: false,
      spin: 0,
    });
  }
}

function confetti(particles: Particle[], amount: number) {
  for (let i = 0; i < amount; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: -12 - Math.random() * 80,
      vx: (Math.random() - 0.5) * 2.6,
      vy: 1.1 + Math.random() * 2.4,
      life: 1,
      max: 1.5 + Math.random(),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 2.2 + Math.random() * 2.6,
      spark: false,
      confetti: true,
      spin: (Math.random() - 0.5) * 0.2,
    });
  }
}

function launchRocket(rockets: Rocket[]) {
  rockets.push({
    x: 36 + Math.random() * Math.max(80, window.innerWidth - 72),
    y: window.innerHeight + 10,
    vx: (Math.random() - 0.5) * 1.4,
    vy: -(6.2 + Math.random() * 2.8),
    targetY: window.innerHeight * (0.12 + Math.random() * 0.32),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    trail: [],
  });
}

/** Full-viewport click fireworks. Canvas never captures clicks. */
export function CelebrateFireworks({ playId }: { playId: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || playId < 1) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const particles: Particle[] = [];
    const rockets: Rocket[] = [];
    const timeouts: number[] = [];
    const mobile = window.innerWidth < 768;
    const cap = mobile ? 280 : 520;
    const started = performance.now();

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

    const rocketCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < rocketCount; i++) {
      timeouts.push(window.setTimeout(() => launchRocket(rockets), 80 + i * 220));
    }
    timeouts.push(
      window.setTimeout(() => confetti(particles, mobile ? 48 : 90), 900),
    );

    const tick = (now: number) => {
      if (!running) return;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (!document.hidden) {
        for (let i = rockets.length - 1; i >= 0; i--) {
          const r = rockets[i];
          r.x += r.vx;
          r.y += r.vy;
          r.vy += 0.018;
          r.trail.push({ x: r.x, y: r.y });
          if (r.trail.length > 16) r.trail.shift();
          ctx.beginPath();
          for (let t = 0; t < r.trail.length; t++) {
            const p = r.trail[t];
            ctx.strokeStyle = r.color;
            ctx.globalAlpha = (t / r.trail.length) * 0.6;
            ctx.lineWidth = 1.8;
            if (t === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#fff6c8";
          ctx.beginPath();
          ctx.arc(r.x, r.y, 2.6, 0, Math.PI * 2);
          ctx.fill();
          if (r.y <= r.targetY || r.vy >= -0.35) {
            burst(particles, r.x, r.y, mobile);
            if (Math.random() > 0.45) burst(particles, r.x + 16, r.y + 10, mobile);
            rockets.splice(i, 1);
          }
        }
        while (particles.length > cap) particles.shift();
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.confetti ? 0.045 : 0.02;
          p.vx *= 0.992;
          if (p.confetti) p.vx += p.spin;
          p.life -= p.confetti ? 0.005 : 0.011;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = Math.max(0, p.life / p.max);
          ctx.fillStyle = p.color;
          if (p.confetti) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.spin * 12);
            ctx.fillRect(-p.size / 2, -p.size * 0.2, p.size, p.size * 0.45);
            ctx.restore();
          } else if (p.spark) {
            ctx.fillRect(p.x, p.y, p.size * 1.7, p.size * 0.45);
            ctx.fillRect(p.x, p.y, p.size * 0.45, p.size * 1.7);
          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
      if (now - started > 8000 && rockets.length === 0 && particles.length === 0) {
        running = false;
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      timeouts.forEach((id) => window.clearTimeout(id));
      particles.length = 0;
      rockets.length = 0;
    };
  }, [playId]);

  if (playId < 1 || !mounted) return null;
  return createPortal(
    <canvas ref={canvasRef} className="apg-celebrate-canvas" aria-hidden />,
    document.body,
  );
}
