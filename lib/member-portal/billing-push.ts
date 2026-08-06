import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

const INDIA_TZ = "Asia/Kolkata";

/** Calendar YYYY-MM-DD in India. */
export function indiaCalendarDateKey(input: Date | string = new Date()): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime()) && typeof input === "string") {
    const m = String(input).match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Day-of-month (1–31) in India for a stored date / timestamp. */
export function indiaDayOfMonth(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return Number(ymd[3]);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: INDIA_TZ,
      day: "numeric",
    }).format(d),
  );
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
    // Gone / not found — remove stale Apple/FCM endpoints so cron stays healthy.
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

export function memberDueOnBillingDay(
  member: {
    next_payment_date?: string | null;
    billing_date?: string | null;
  },
  matchField: "billing_date" | "next_payment_date",
  todayYmd: string,
  todayDay: number,
): boolean {
  if (matchField === "next_payment_date") {
    const raw = member.next_payment_date;
    if (!raw) return false;
    const key = /^\d{4}-\d{2}-\d{2}/.test(String(raw))
      ? String(raw).slice(0, 10)
      : indiaCalendarDateKey(String(raw));
    return key === todayYmd;
  }

  const day = indiaDayOfMonth(member.billing_date);
  return day === todayDay;
}
