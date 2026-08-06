import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

const INDIA_TZ = "Asia/Kolkata";

export const DEFAULT_BILLING_PUSH_TITLE = "Billing date reminder";
export const DEFAULT_BILLING_PUSH_BODY =
  "Today is your billing date. Please clear your payment within one week to avoid a fine.";
export const DEFAULT_OVERDUE_PUSH_TITLE = "Late payment notice";
export const DEFAULT_OVERDUE_PUSH_BODY =
  "A fine has been added to your plan. Please clear within 1 week to avoid deactivation or membership cancellation, or reach out to the gym if there is any issue.";

/** Calendar YYYY-MM-DD in India. */
export function indiaCalendarDateKey(input: Date | string = new Date()): string {
  if (typeof input === "string") {
    const m = String(input).trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return indiaCalendarDateKey(new Date());
    return indiaCalendarDateKey(d);
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(input);
}

/** Current hour (0–23) in India. */
export function indiaHour(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: INDIA_TZ,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const raw = Number(parts.find((p) => p.type === "hour")?.value);
  if (!Number.isFinite(raw)) return 0;
  return raw === 24 ? 0 : raw;
}

/** Parse stored date to YYYY-MM-DD (calendar, no UTC shift). */
export function dateOnlyKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return null;
  return indiaCalendarDateKey(d);
}

export function addDaysToYmd(ymd: string, days: number): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Payment By: stored payment_by, else billing_date + 7 days. */
export function resolvePaymentByYmd(member: {
  billing_date?: string | null;
  payment_by?: string | null;
  next_payment_date?: string | null;
}): string | null {
  const stored = dateOnlyKey(member.payment_by);
  if (stored) return stored;
  const billing = dateOnlyKey(member.billing_date) || dateOnlyKey(member.next_payment_date);
  if (!billing) return null;
  return addDaysToYmd(billing, 7);
}

export function resolveBillingYmd(member: {
  billing_date?: string | null;
  next_payment_date?: string | null;
}): string | null {
  return dateOnlyKey(member.billing_date) || dateOnlyKey(member.next_payment_date);
}

export function configureWebPush():
  | { ok: true; publicKey: string; privateKey: string }
  | { ok: false; error: string } {
  const publicKey = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "").trim();
  const subject = String(
    process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:owner@actionplusgym.com",
  ).trim();
  if (!publicKey || !privateKey) {
    return { ok: false, error: "vapid-missing" };
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { ok: true, publicKey, privateKey };
}

export type PushSubRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type SendResult = { sent: number; failed: number };

/** Send one Web Push payload to a subscription; drop gone endpoints. */
export async function sendPushToSubscription(
  svc: SupabaseClient,
  opts: {
    gymId: string;
    memberUuid: string;
    sub: PushSubRow;
    title: string;
    body: string;
    url?: string;
    kind: string;
    tag?: string;
    log?: boolean;
  },
): Promise<boolean> {
  const {
    gymId,
    memberUuid,
    sub,
    title,
    body,
    url = "/members",
    kind,
    tag,
    log = true,
  } = opts;

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify({ title, body, url, tag: tag || kind }),
    );
    if (log) {
      await svc.from("member_portal_push_send_log").insert({
        gym_id: gymId,
        member_uuid: memberUuid,
        kind,
        title,
        body,
        success: true,
      });
    }
    return true;
  } catch (err) {
    const statusCode =
      err && typeof err === "object" && "statusCode" in err
        ? Number((err as { statusCode?: number }).statusCode)
        : 0;
    if (statusCode === 404 || statusCode === 410) {
      await svc
        .from("member_portal_push_subscriptions")
        .delete()
        .eq("gym_id", gymId)
        .eq("endpoint", sub.endpoint);
    }
    if (log) {
      await svc.from("member_portal_push_send_log").insert({
        gym_id: gymId,
        member_uuid: memberUuid,
        kind,
        title,
        body,
        success: false,
        error: err instanceof Error ? err.message : "send-failed",
      });
    }
    return false;
  }
}

export async function sendPushToMemberSubscriptions(
  svc: SupabaseClient,
  opts: {
    gymId: string;
    memberUuid: string;
    title: string;
    body: string;
    url?: string;
    kind: string;
    tag?: string;
    log?: boolean;
  },
): Promise<SendResult> {
  const { data: subs } = await svc
    .from("member_portal_push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("gym_id", opts.gymId)
    .eq("member_uuid", opts.memberUuid);

  let sent = 0;
  let failed = 0;
  for (const sub of (subs || []) as PushSubRow[]) {
    const ok = await sendPushToSubscription(svc, { ...opts, sub });
    if (ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed };
}

/** True if a successful push of this kind was already logged today (IST). */
export async function alreadySentKindToday(
  svc: SupabaseClient,
  opts: { gymId: string; memberUuid: string; kind: string; todayYmd: string },
): Promise<boolean> {
  const startIst = `${opts.todayYmd}T00:00:00+05:30`;
  const endIst = `${addDaysToYmd(opts.todayYmd, 1)}T00:00:00+05:30`;
  const { data } = await svc
    .from("member_portal_push_send_log")
    .select("id")
    .eq("gym_id", opts.gymId)
    .eq("member_uuid", opts.memberUuid)
    .eq("kind", opts.kind)
    .eq("success", true)
    .gte("created_at", startIst)
    .lt("created_at", endIst)
    .limit(1);
  return Boolean(data && data.length);
}

/**
 * True if overdue push already sent for this Payment By cycle
 * (any successful payment_overdue after the payment-by date).
 */
export async function alreadySentOverdueForCycle(
  svc: SupabaseClient,
  opts: { gymId: string; memberUuid: string; paymentByYmd: string },
): Promise<boolean> {
  const after = `${opts.paymentByYmd}T00:00:00+05:30`;
  const { data } = await svc
    .from("member_portal_push_send_log")
    .select("id")
    .eq("gym_id", opts.gymId)
    .eq("member_uuid", opts.memberUuid)
    .eq("kind", "payment_overdue")
    .eq("success", true)
    .gte("created_at", after)
    .limit(1);
  return Boolean(data && data.length);
}

export function clampPushHourIst(value: unknown, fallback = 8): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const h = Math.floor(n);
  if (h < 0 || h > 23) return fallback;
  return h;
}
