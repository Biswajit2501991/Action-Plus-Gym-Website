"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { websiteSections } from "@/lib/admin/website-nav";
import { cn } from "@/lib/utils";

export function WebsiteSubnav() {
  const pathname = usePathname();

  return (
    <div className="mb-8 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/admin/website"
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider",
            pathname === "/admin/website"
              ? "gold-gradient text-black"
              : "border border-white/15 text-white/70 hover:border-gold/40",
          )}
        >
          All sections
        </Link>
        {websiteSections.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider",
              pathname === item.href
                ? "gold-gradient text-black"
                : "border border-white/15 text-white/70 hover:border-gold/40",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
