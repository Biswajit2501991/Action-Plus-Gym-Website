"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { websiteSections } from "@/lib/admin/website-nav";

function matches(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [...websiteSections];
  return websiteSections.filter((item) =>
    `${item.label} ${item.description}`.toLowerCase().includes(q),
  );
}

export function WebsiteSectionSearch({ variant = "dropdown" }: { variant?: "dropdown" | "cards" }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const found = useMemo(() => matches(query), [query]);
  const typing = query.trim().length > 0;

  return (
    <div className={variant === "cards" ? "space-y-4" : "space-y-2"}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && found[0]) {
            e.preventDefault();
            router.push(found[0].href);
          }
        }}
        placeholder="Search sections"
        aria-label="Search website sections"
        className="h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-gold/40"
      />
      {variant === "cards" ? (
        found.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {found.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-white/10 bg-charcoal/50 p-5 transition hover:border-gold/40 hover:bg-charcoal"
              >
                <h2 className="font-display text-xl text-white">{item.label}</h2>
                <p className="mt-2 text-sm text-muted">{item.description}</p>
                <p className="mt-4 text-xs text-gold">Configure →</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No section matches “{query.trim()}”.</p>
        )
      ) : typing ? (
        found.length ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            {found.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block border-b border-white/5 px-4 py-3 last:border-b-0 hover:bg-white/5"
              >
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="text-xs text-muted">{item.description}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No section matches “{query.trim()}”.</p>
        )
      ) : null}
    </div>
  );
}
