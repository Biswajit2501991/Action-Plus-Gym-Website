import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";
import {
  configureWebPush,
  indiaCalendarDateKey,
  indiaDayOfMonth,
  memberDueOnBillingDay,
  sendPushToMemberSubscriptions,
} from "@/lib/member-portal/billing-push";

export const dynamic = "force-dynamic";

/**
 * Cron / internal: send billing-day Web Push (India calendar day).
 * Auth: Authorization: Bearer $MEMBER_PORTAL_CRON_SECRET
 *
 * Schedule this daily (e.g. GitHub Actions workflow billing-push-cron.yml
 * or any external cron) — enabling reminders alone does not send pushes.
 */
async function runBillingPushCron(req: Request) {
  const secret = String(process.env.MEMBER_PORTAL_CRON_SECRET || "").trim();
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!secret || token !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const vapid = configureWebPush();
  if (!vapid.ok) {
    return NextResponse.json({ ok: false, error: vapid.error }, { status: 503 });
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const gymId = portalGymId();
  const { data: settings } = await svc.client
    .from("member_portal_settings")
    .select("*")
    .eq("gym_id", gymId)
    .maybeSingle();

  if (settings && settings.billing_push_enabled === false) {
    return NextResponse.json({ ok: true, skipped: true, reason: "disabled" });
  }

  const title = settings?.billing_push_title || "Billing reminder";
  const body =
    settings?.billing_push_body ||
    "Your membership billing date is today. Please renew at the gym.";
  const matchField =
    settings?.billing_match_field === "billing_date"
      ? "billing_date"
      : "next_payment_date";

  const todayYmd = indiaCalendarDateKey(new Date());
  const todayDay = Number(todayYmd.slice(8, 10));
  const yyyyMm = todayYmd.slice(0, 7);

  const { data: members, error: mErr } = await svc.client
    .from("members")
    .select("member_uuid, full_name, next_payment_date, billing_date, status, portal_enabled")
    .eq("gym_id", gymId)
    .eq("portal_enabled", true)
    .is("deleted_at", null)
    .ilike("status", "active");
  if (mErr) {
    return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 });
  }

  const due = (members || []).filter((m) =>
    memberDueOnBillingDay(m, matchField, todayYmd, todayDay),
  );

  let sent = 0;
  let failed = 0;

  for (const m of due) {
    if (!m.member_uuid) continue;
    const result = await sendPushToMemberSubscriptions(svc.client, {
      gymId,
      memberUuid: m.member_uuid,
      title,
      body: body.replace("{name}", m.full_name || "Member"),
      url: "/members",
      kind: "billing_day",
      tag: `billing-${yyyyMm}`,
    });
    sent += result.sent;
    failed += result.failed;
  }

  return NextResponse.json({
    ok: true,
    dueCount: due.length,
    sent,
    failed,
    matchField,
    todayIndia: todayYmd,
    // Keep for debugging timezone regressions without exposing member data.
    todayDayIndia: indiaDayOfMonth(todayYmd),
  });
}

export async function POST(req: Request) {
  return runBillingPushCron(req);
}

/** Some cron hosts only support GET — same auth via Authorization header. */
export async function GET(req: Request) {
  return runBillingPushCron(req);
}
