import { getAdminSession, isOwnerRole } from "@/lib/auth/session";
import { logoutAction } from "@/lib/actions/admin";
import { countBotUnreadAction } from "@/lib/actions/bot-admin";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AdminNav } from "@/components/admin/AdminNav";

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
  const unreadMessages = session ? await countBotUnreadAction() : 0;

  return (
    <div className="admin-shell">
      {session ? (
        <div className="flex min-h-screen">
          <aside className="hidden w-64 flex-col border-r border-[color:var(--panel-border)] bg-[color:var(--bg-elevated)]/80 p-5 md:flex">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-lg text-gold-gradient">APG Admin</p>
                <p className="mt-1 text-xs text-muted">
                  {session.full_name || session.staff_login_id} · {session.staff_role}
                </p>
              </div>
              <form action={logoutAction} className="shrink-0 pt-0.5">
                <button
                  type="submit"
                  className="rounded-full border border-pink-300/70 bg-pink-200/80 px-2.5 py-1 text-[11px] font-semibold text-pink-900 transition hover:bg-pink-300 hover:border-pink-400"
                >
                  Logout
                </button>
              </form>
            </div>
            <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/5 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
                Day / Night
              </p>
              <ThemeToggle className="w-full justify-between" />
            </div>
            <AdminNav owner={owner} unreadMessages={unreadMessages} />
            <p className="mt-auto pt-6 text-[11px] leading-relaxed text-muted">
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
            <header className="flex items-center justify-between gap-3 border-b border-[color:var(--panel-border)] px-5 py-4 md:hidden">
              <p className="font-display text-gold">APG Admin</p>
              <div className="flex items-center gap-2">
                <ThemeToggle compact />
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="rounded-full border border-pink-300/70 bg-pink-200/80 px-2.5 py-1 text-[11px] font-semibold text-pink-900 transition hover:bg-pink-300"
                  >
                    Logout
                  </button>
                </form>
              </div>
            </header>
            <div className="flex gap-2 overflow-x-auto border-b border-[color:var(--panel-border)] px-4 py-3 md:hidden">
              <AdminNav
                owner={owner}
                unreadMessages={unreadMessages}
                variant="mobile"
              />
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
