import type { Metadata } from "next";
import Link from "next/link";
import { MemberPortalApp } from "@/components/members/MemberPortalApp";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const metadata: Metadata = {
  title: "Member Portal | Action Plus Gym",
  description: "Secure member portal — OTP login, membership card, and profile.",
};

export default function MembersPortalPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(201,162,39,0.12),_transparent_55%),linear-gradient(180deg,#0a0a0a,#050505)]">
      <header className="flex items-center justify-between px-5 py-5 md:px-8">
        <Link href="/" className="font-display text-xl text-gold-gradient">
          Action Plus Gym
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle compact />
          <Link href="/contact" className="text-sm text-white/70 hover:text-gold">
            Contact
          </Link>
        </div>
      </header>
      <main>
        <MemberPortalApp />
      </main>
    </div>
  );
}
