import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { overviewAction } from "@/lib/actions/admin";
import { getSiteContent } from "@/lib/cms/get-site-content";
import { isOwnerRole } from "@/lib/auth/session";

export default async function AdminHomePage() {
  const session = await requireAdmin();
  const overview = await overviewAction();
  const content = await getSiteContent();
  const owner = isOwnerRole(session.staff_role);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Welcome back, {session.full_name || session.staff_login_id}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Leads today", value: overview?.leads_today ?? 0 },
          { label: "Total website leads", value: overview?.leads_total ?? 0 },
          {
            label: "Popup status",
            value: overview?.popup_enabled ? "ON" : "OFF",
          },
          {
            label: "Google rating",
            value: content.reviews?.overall_rating ?? "—",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/10 bg-charcoal/50 p-5"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              {card.label}
            </p>
            <p className="mt-3 font-display text-3xl text-gold">{card.value}</p>
          </div>
        ))}
      </div>

      {owner ? (
        <div>
          <h2 className="mb-3 font-display text-xl text-white">
            Website sections
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(content.sections).map(([key, enabled]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm"
              >
                <span className="capitalize text-white/85">{key}</span>
                <span className={enabled ? "text-emerald-300" : "text-muted"}>
                  {enabled ? "ON" : "OFF"}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/admin/website"
            className="mt-4 inline-block text-sm text-gold hover:underline"
          >
            Open Website configuration →
          </Link>
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-charcoal/40 p-5 text-sm text-muted">
        New website leads appear immediately in{" "}
        <a
          href="https://app.gymactionplus.com/"
          className="text-gold"
          target="_blank"
          rel="noreferrer"
        >
          Gym Manager Visitors
        </a>{" "}
        with intake source website / website_trial / website_contact.
      </div>
    </div>
  );
}
