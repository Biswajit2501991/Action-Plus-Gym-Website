"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { websiteSections } from "@/lib/admin/website-nav";

const mainNav = [
  { href: "/admin", label: "Overview", ownerOnly: false },
  { href: "/admin/leads", label: "Leads", ownerOnly: false },
  { href: "/admin/messages", label: "Messages", ownerOnly: false },
  { href: "/admin/website", label: "Website", ownerOnly: true },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({
  owner,
  unreadMessages,
  variant = "sidebar",
}: {
  owner: boolean;
  unreadMessages: number;
  variant?: "sidebar" | "mobile";
}) {
  const pathname = usePathname() || "/admin";

  if (variant === "mobile") {
    return (
      <>
        {mainNav
          .filter((n) => !n.ownerOnly || owner)
          .map((n) => {
            const active = isActivePath(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition",
                  active
                    ? "border-gold/50 bg-gold text-black"
                    : "border-[color:var(--panel-border)] text-[color:var(--ink-soft)] hover:border-gold/40 hover:text-gold",
                )}
              >
                {n.label}
                {n.href === "/admin/messages" && unreadMessages > 0 ? (
                  <span className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-red-500 px-1 py-0.5 text-[9px] font-bold leading-none text-white">
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                ) : null}
              </Link>
            );
          })}
        {owner
          ? websiteSections.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "whitespace-nowrap rounded-full border px-3 py-1 text-xs transition",
                    active
                      ? "border-gold/50 bg-gold text-black"
                      : "border-[color:var(--panel-border)] text-[color:var(--ink-soft)] hover:border-gold/40 hover:text-gold",
                  )}
                >
                  {item.label}
                </Link>
              );
            })
          : null}
      </>
    );
  }

  return (
    <nav className="mt-6 flex flex-col gap-1">
      {mainNav
        .filter((n) => !n.ownerOnly || owner)
        .map((n) => {
          const active = isActivePath(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition",
                active
                  ? "bg-gold/20 font-semibold text-gold ring-1 ring-gold/40"
                  : "text-[color:var(--ink-soft)] hover:bg-[color:var(--surface-soft)] hover:text-gold",
              )}
              aria-current={active ? "page" : undefined}
            >
              <span>{n.label}</span>
              {n.href === "/admin/messages" && unreadMessages > 0 ? (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              ) : null}
            </Link>
          );
        })}

      {owner ? (
        <div className="mt-3 border-t border-[color:var(--panel-border)] pt-3">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/80">
            Website sections
          </p>
          <div className="flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto">
            {websiteSections.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs transition",
                    active
                      ? "bg-gold/20 font-semibold text-gold ring-1 ring-gold/35"
                      : "text-[color:var(--ink-faint)] hover:bg-[color:var(--surface-soft)] hover:text-gold",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
