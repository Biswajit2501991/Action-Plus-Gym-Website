import { NextResponse } from "next/server";
import webpush from "web-push";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";

export const dynamic = "force-dynamic";

/**
 * Cron / internal: send billing-day Web Push.
 * Auth: Authorization: Bearer $MEMBER_PORTAL_CRON_SECRET
 */
export async function POST(req: Request) {
  const secret = String(process.env.MEMBER_PORTAL_CRON_SECRET || "").trim();
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!secret || token !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const publicKey = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "").trim();
  const subject = String(process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:owner@actionplusgym.com").trim();
  if (!publicKey || !privateKey) {
    return NextResponse.json({ ok: false, error: "vapid-missing" }, { status: 503 });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

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

  const today = new Date();
  const day = today.getUTCDate();
  const yyyyMm = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;

  // Members due today: next_payment_date date equals today OR day-of-month matches for billing_date
  let membersQuery = svc.client
    .from("members")
    .select("member_uuid, full_name, next_payment_date, billing_date, status, portal_enabled")
    .eq("gym_id", gymId)
    .eq("portal_enabled", true)
    .is("deleted_at", null)
    .ilike("status", "active");

  const { data: members, error: mErr } = await membersQuery;
  if (mErr) {
    return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 });
  }

  const due = (members || []).filter((m) => {
    const raw = matchField === "billing_date" ? m.billing_date : m.next_payment_date;
    if (!raw) return false;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      // billing_date might be day number stored oddly — also accept YYYY-MM-DD string day match
      const s = String(raw);
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        return Number(s.slice(8, 10)) === day;
      }
      return false;
    }
    if (matchField === "next_payment_date") {
      return d.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
    }
    return d.getUTCDate() === day;
  });

  let sent = 0;
  let failed = 0;

  for (const m of due) {
    const { data: subs } = await svc.client
      .from("member_portal_push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("gym_id", gymId)
      .eq("member_uuid", m.member_uuid);

    for (const sub of subs || []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title,
            body: body.replace("{name}", m.full_name || "Member"),
            url: "/members",
            month: yyyyMm,
          }),
        );
        sent += 1;
        await svc.client.from("member_portal_push_send_log").insert({
          gym_id: gymId,
          member_uuid: m.member_uuid,
          kind: "billing_day",
          title,
          body,
          success: true,
        });
      } catch (err) {
        failed += 1;
        await svc.client.from("member_portal_push_send_log").insert({
          gym_id: gymId,
          member_uuid: m.member_uuid,
          kind: "billing_day",
          title,
          body,
          success: false,
          error: err instanceof Error ? err.message : "send-failed",
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    dueCount: due.length,
    sent,
    failed,
    matchField,
  });
}
