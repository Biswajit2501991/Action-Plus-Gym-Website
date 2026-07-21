"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { submitNewsletter } from "@/lib/actions/leads";
import type { OpeningHour, WebsiteSettings } from "@/lib/types";
import { getTodayDayOfWeek } from "@/lib/hours";
import { DAY_NAMES, formatTime } from "@/lib/utils";

export function Footer({
  settings,
  hours,
}: {
  settings: WebsiteSettings;
  hours: OpeningHour[];
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const todayDow = getTodayDayOfWeek(settings.timezone || "Asia/Kolkata");
  const visibleHours = [...hours]
    .filter((h) => !h.is_hidden)
    .sort((a, b) => {
      const aa = a.day_of_week === 0 ? 7 : a.day_of_week;
      const bb = b.day_of_week === 0 ? 7 : b.day_of_week;
      return aa - bb;
    });

  return (
    <footer className="border-t border-white/10 bg-black/50">
      <div className="container-site grid gap-10 px-5 py-16 md:grid-cols-4 md:px-8">
        <div>
          <p className="font-display text-2xl text-gold-gradient">
            {settings.site_name}
          </p>
          <p className="mt-3 text-sm text-muted">{settings.tagline}</p>
          <div className="mt-4 flex gap-4 text-sm text-white/70">
            {Object.entries(settings.socials || {}).map(([k, v]) => (
              <a key={k} href={v} target="_blank" rel="noreferrer" className="hover:text-gold capitalize">
                {k}
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-gold">
            Quick Links
          </p>
          <div className="flex flex-col gap-2 text-sm text-white/75">
            <Link href="#services">Services</Link>
            <Link href="#pricing">Pricing</Link>
            <Link href="#trainers">Trainers</Link>
            <Link href="/members">Member Portal</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-gold">
            Hours
          </p>
          <ul className="space-y-2 text-sm text-white/75">
            {visibleHours.map((h) => {
              const isToday = h.day_of_week === todayDow;
              return (
                <li
                  key={h.id}
                  className={`flex justify-between gap-4 rounded-lg px-2 py-1 ${
                    isToday ? "bg-gold/10 text-gold" : ""
                  }`}
                >
                  <span className={isToday ? "font-semibold" : undefined}>
                    {DAY_NAMES[h.day_of_week].slice(0, 3)}
                    {isToday ? " · Today" : ""}
                  </span>
                  <span className={isToday ? "font-medium text-gold-soft" : undefined}>
                    {h.is_closed
                      ? "Closed"
                      : `${formatTime(h.open_time)} – ${formatTime(h.close_time)}`}
                  </span>
                </li>
              );
            })}
          </ul>
          {settings.google_reviews_url ? (
            <a
              href={settings.google_reviews_url}
              className="mt-4 inline-block text-sm text-gold hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Google Reviews
            </a>
          ) : null}
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-gold">
            Newsletter
          </p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const res = await submitNewsletter(String(fd.get("email") || ""));
                setMsg(res.ok ? "Subscribed." : res.error);
              });
            }}
          >
            <input
              name="email"
              type="email"
              required
              placeholder="Email address"
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:ring focus:ring-gold/40"
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full gold-gradient px-4 py-3 text-sm font-semibold text-black"
            >
              {pending ? "..." : "Subscribe"}
            </button>
            {msg ? <p className="text-xs text-muted">{msg}</p> : null}
          </form>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} {settings.site_name}. All rights reserved.
      </div>
    </footer>
  );
}
