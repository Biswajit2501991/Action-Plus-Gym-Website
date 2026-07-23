import Link from "next/link";
import { MemberPortalApp } from "@/components/members/MemberPortalApp";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function MembersPortalPage() {
  return (
    <div className="member-portal-shell min-h-screen overflow-x-hidden">
      <header className="flex items-center justify-between px-4 py-4 sm:px-5 sm:py-5 md:px-8">
        <Link href="/" className="font-display text-lg text-gold-gradient sm:text-xl">
          Action Plus Gym
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle compact />
          <Link href="/contact" className="text-sm text-white/70 hover:text-gold">
            Contact
          </Link>
        </div>
      </header>
      <main className="pb-[max(1rem,env(safe-area-inset-bottom))]">
        <MemberPortalApp />
      </main>
    </div>
  );
}
