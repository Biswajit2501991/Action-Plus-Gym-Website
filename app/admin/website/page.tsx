import Link from "next/link";
import { websiteSections } from "@/lib/admin/website-nav";

export default function WebsiteHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-white">Website</h1>
        <p className="mt-1 text-sm text-muted">
          Choose a section below to edit what visitors see on actionplusgym.com.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {websiteSections.map((item) => (
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
    </div>
  );
}
