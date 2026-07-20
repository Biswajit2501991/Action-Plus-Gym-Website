import Link from "next/link";
import { getAdminSession, isOwnerRole } from "@/lib/auth/session";
import { logoutAction } from "@/lib/actions/admin";
import { websiteSections } from "@/lib/admin/website-nav";

const mainNav = [
  { href: "/admin", label: "Overview", ownerOnly: false },
  { href: "/admin/leads", label: "Leads", ownerOnly: false },
  { href: "/admin/messages", label: "Messages", ownerOnly: false },
  { href: "/admin/website", label: "Website", ownerOnly: true },
];

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session = null;
  try {
    session = await getAdminSession();
  } catch {
    session = null;
  }
  const owner = session ? isOwnerRole(session.staff_role) : false;

  return (
    <div className="min-h-screen bg-[#080808]">
      {session ? (
        <div className="flex min-h-screen">
          <aside className="hidden w-64 flex-col border-r border-white/10 bg-black/60 p-5 md:flex">
            <p className="font-display text-lg text-gold-gradient">APG Admin</p>
            <p className="mt-1 text-xs text-muted">
              {session.full_name || session.staff_login_id} · {session.staff_role}
            </p>
            <nav className="mt-8 flex flex-col gap-1">
              {mainNav
                .filter((n) => !n.ownerOnly || owner)
                .map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="rounded-xl px-3 py-2 text-sm text-white/75 hover:bg-white/5 hover:text-gold"
                  >
                    {n.label}
                  </Link>
                ))}

              {owner ? (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/80">
                    Website sections
                  </p>
                  <div className="flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto">
                    {websiteSections.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="rounded-lg px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-gold"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </nav>
            <form action={logoutAction} className="mt-auto pt-6">
              <button
                type="submit"
                className="text-sm text-muted hover:text-white"
              >
                Sign out
              </button>
            </form>
            <p className="mt-4 text-[11px] leading-relaxed text-muted">
              Staff accounts are managed in{" "}
              <a
                href="https://app.gymactionplus.com/"
                className="text-gold"
                target="_blank"
                rel="noreferrer"
              >
                Gym Manager
              </a>
              .
            </p>
          </aside>
          <div className="flex-1">
            <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 md:hidden">
              <p className="font-display text-gold">APG Admin</p>
              <form action={logoutAction}>
                <button type="submit" className="text-xs text-muted">
                  Sign out
                </button>
              </form>
            </header>
            <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-4 py-3 md:hidden">
              {mainNav
                .filter((n) => !n.ownerOnly || owner)
                .map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="whitespace-nowrap rounded-full border border-white/10 px-3 py-1 text-xs text-white/80"
                  >
                    {n.label}
                  </Link>
                ))}
              {owner
                ? websiteSections.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="whitespace-nowrap rounded-full border border-white/10 px-3 py-1 text-xs text-white/80"
                    >
                      {item.label}
                    </Link>
                  ))
                : null}
            </div>
            <main className="p-5 md:p-8">{children}</main>
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
