"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const actions = [
  { href: "/members", label: "Member Portal", join: false },
  { href: "/contact", label: "Contact", join: false },
  { href: "#join", label: "Join Now", join: true },
] as const;

const links = [
  { href: "#services", label: "Services" },
  { href: "#pricing", label: "Pricing" },
  { href: "#trainers", label: "Trainers" },
  { href: "#gallery", label: "Gallery" },
  { href: "#reviews", label: "Reviews" },
];

const DEFAULT_RETURNING_BAR = "Welcome back — book a visit";

export function Navbar({
  brand,
  darkHero = false,
  returningMessage,
  extraLinks = [],
}: {
  brand: string;
  /** Keep light nav text over a dark full-bleed hero (homepage). */
  darkHero?: boolean;
  /** Blank keeps the default returning-visitor line. */
  returningMessage?: string | null;
  /** Extra homepage anchors, inserted after Trainers. */
  extraLinks?: { href: string; label: string }[];
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuTop, setMenuTop] = useState(72);
  const [returning, setReturning] = useState(false);

  function toggleMenu() {
    if (!open && barRef.current) {
      setMenuTop(barRef.current.getBoundingClientRect().bottom);
    }
    setOpen((current) => !current);
  }

  useEffect(() => {
    try {
      setReturning(localStorage.getItem("apg_popup_dismissed") === "1");
    } catch {
      setReturning(false);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const previousHtml = html.style.overflow;
    const previousBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    const measure = () => {
      if (!barRef.current) return;
      setMenuTop(barRef.current.getBoundingClientRect().bottom);
    };
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      html.style.overflow = previousHtml;
      body.style.overflow = previousBody;
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [open, scrolled, returning, returningMessage]);

  const overHero = darkHero && !scrolled;
  const navLinks = [...links.slice(0, 3), ...extraLinks, ...links.slice(3)];

  return (
    <header
      className="fixed inset-x-0 top-0 z-50"
      {...(overHero ? { "data-on-dark": "" } : {})}
    >
      <div
        ref={barRef}
        className={cn(
          "transition-all duration-300",
          scrolled ? "glass py-3 shadow-lg shadow-black/30" : "bg-transparent py-5",
        )}
      >
      <div className="container-site flex items-center justify-between gap-4 px-5 md:px-8">
        <Link href="/" className="font-display text-xl tracking-tight text-white md:text-2xl">
          <span className="text-gold-gradient">{brand}</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-white/75 transition hover:text-gold"
            >
              {l.label}
            </Link>
          ))}
          {actions.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn("nav-action", item.join && "nav-action-join")}
            >
              {item.label}
              {item.join ? <span className="nav-action-arrow">↗</span> : null}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            className="rounded-full border border-white/15 p-2 text-white"
            onClick={toggleMenu}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {returning ? (
        <Link
          href="/#join"
          className="block border-t border-gold/20 bg-black/50 px-5 py-1.5 text-center text-xs tracking-wide text-gold"
        >
          {returningMessage?.trim() || DEFAULT_RETURNING_BAR}
        </Link>
      ) : null}
      </div>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="site-mobile-nav fixed inset-x-0 z-[45] flex flex-col overflow-y-auto overscroll-contain px-5 pb-8 pt-4 lg:hidden"
              style={{ top: menuTop, height: `calc(100dvh - ${menuTop}px)` }}
            >
              <div className="flex flex-col">
                {navLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="site-mobile-link"
                    onClick={() => setOpen(false)}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
              <div className="mt-5 flex flex-col">
                {actions.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn("nav-action nav-action-mobile", item.join && "nav-action-join")}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                    {item.join ? <span className="nav-action-arrow">↗</span> : null}
                  </Link>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </header>
  );
}
