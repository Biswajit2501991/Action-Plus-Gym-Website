import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";
import {
  DEFAULT_BILLING_PUSH_BODY,
  DEFAULT_BILLING_PUSH_TITLE,
  DEFAULT_OVERDUE_PUSH_BODY,
  DEFAULT_OVERDUE_PUSH_TITLE,
  alreadySentKindToday,
  alreadySentOverdueForCycle,
  clampPushHourIst,
  configureWebPush,
  indiaCalendarDateKey,
  indiaHour,
  resolveBillingYmd,
  resolvePaymentByYmd,
  sendPushToMemberSubscriptions,
} from "@/lib/member-portal/billing-push";

export const dynamic = "force-dynamic";

/**
 * Cron / internal: billing-date + Payment-By-overdue Web Push (India time).
 * Auth: Authorization: Bearer $MEMBER_PORTAL_CRON_SECRET
 *
 * Run hourly at :30 UTC (= :00 IST). Sends only when current IST hour matches
 * member_portal_settings.billing_push_hour_ist (default 8).
 * Pass ?force_time=1 to skip the hour gate (manual test).
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

  const url = new URL(req.url);
  const forceTime = url.searchParams.get("force_time") === "1";
  const configuredHour = clampPushHourIst(settings?.billing_push_hour_ist, 8);
  const nowHour = indiaHour(new Date());
  if (!forceTime && nowHour !== configuredHour) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "outside-trigger-hour",
      configuredHourIst: configuredHour,
      currentHourIst: nowHour,
    });
  }

  const billingTitle =
    String(settings?.billing_push_title || "").trim() || DEFAULT_BILLING_PUSH_TITLE;
  const billingBody =
    String(settings?.billing_push_body || "").trim() || DEFAULT_BILLING_PUSH_BODY;
  const overdueTitle =
    String(settings?.billing_push_overdue_title || "").trim() || DEFAULT_OVERDUE_PUSH_TITLE;
  const overdueBody =
    String(settings?.billing_push_overdue_body || "").trim() || DEFAULT_OVERDUE_PUSH_BODY;

  const todayYmd = indiaCalendarDateKey(new Date());

  const { data: members, error: mErr } = await svc.client
    .from("members")
    .select(
      "member_uuid, full_name, next_payment_date, billing_date, payment_by, status, portal_enabled",
    )
    .eq("gym_id", gymId)
    .eq("portal_enabled", true)
    .is("deleted_at", null)
    .ilike("status", "active");
  if (mErr) {
    return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 });
  }

  let billingDue = 0;
  let overdueDue = 0;
  let sent = 0;
  let failed = 0;
  let skippedDup = 0;

  for (const m of members || []) {
    if (!m.member_uuid) continue;
    const name = m.full_name || "Member";

    const billingYmd = resolveBillingYmd(m);
    if (billingYmd && billingYmd === todayYmd) {
      billingDue += 1;
      const dup = await alreadySentKindToday(svc.client, {
        gymId,
        memberUuid: m.member_uuid,
        kind: "billing_date",
        todayYmd,
      });
      if (dup) {
        skippedDup += 1;
      } else {
        const result = await sendPushToMemberSubscriptions(svc.client, {
          gymId,
          memberUuid: m.member_uuid,
          title: billingTitle,
          body: billingBody.replace("{name}", name),
          url: "/members",
          kind: "billing_date",
          tag: `billing-date-${todayYmd}`,
        });
        sent += result.sent;
        failed += result.failed;
      }
    }

    const paymentByYmd = resolvePaymentByYmd(m);
    // Payment By is over → today is strictly after Payment By (IST calendar).
    if (paymentByYmd && todayYmd > paymentByYmd) {
      overdueDue += 1;
      const dup = await alreadySentOverdueForCycle(svc.client, {
        gymId,
        memberUuid: m.member_uuid,
        paymentByYmd,
      });
      if (dup) {
        skippedDup += 1;
      } else {
        const result = await sendPushToMemberSubscriptions(svc.client, {
          gymId,
          memberUuid: m.member_uuid,
          title: overdueTitle,
          body: overdueBody.replace("{name}", name),
          url: "/members",
          kind: "payment_overdue",
          tag: `payment-overdue-${paymentByYmd}`,
        });
        sent += result.sent;
        failed += result.failed;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    todayIndia: todayYmd,
    triggerHourIst: configuredHour,
    currentHourIst: nowHour,
    forceTime,
    billingDue,
    overdueDue,
    sent,
    failed,
    skippedDup,
  });
}

export async function POST(req: Request) {
  return runBillingPushCron(req);
}

export async function GET(req: Request) {
  return runBillingPushCron(req);
}
