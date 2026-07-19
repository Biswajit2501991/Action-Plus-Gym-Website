"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const links = [
  { href: "#services", label: "Services" },
  { href: "#pricing", label: "Pricing" },
  { href: "#trainers", label: "Trainers" },
  { href: "#gallery", label: "Gallery" },
  { href: "#reviews", label: "Reviews" },
];

export function Navbar({ brand }: { brand: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "glass py-3 shadow-lg shadow-black/30" : "bg-transparent py-5",
      )}
    >
      <div className="container-site flex items-center justify-between gap-4 px-5 md:px-8">
        <Link href="/" className="font-display text-xl tracking-tight text-white md:text-2xl">
          <span className="text-gold-gradient">{brand}</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-white/75 transition hover:text-gold"
            >
              {l.label}
            </Link>
          ))}
          <div className="flex items-center gap-2">
            <Button href="/contact" className="!py-2.5 !text-xs">
              Contact
            </Button>
            <Button href="#join" className="!py-2.5 !text-xs">
              Join Now
            </Button>
          </div>
        </nav>

        <button
          type="button"
          className="rounded-full border border-white/15 p-2 text-white lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open ? (
        <div className="glass mt-3 border-t border-white/10 px-5 py-4 lg:hidden">
          <div className="flex flex-col gap-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-white/85"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <Button href="/contact" onClick={() => setOpen(false)}>
              Contact
            </Button>
            <Button href="#join" onClick={() => setOpen(false)}>
              Join Now
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
