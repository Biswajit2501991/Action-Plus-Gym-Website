/**
 * Deliver a Web Push payload to staff phones.
 * Does not write member subscriptions, billing logs, or chat.
 */

import webpush from "web-push";
import { configureWebPush } from "@/lib/member-portal/billing-push";

export type StaffPushItem = {
  endpoint: string;
  p256dh: string;
  auth: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function deliverStaffPushes(items: StaffPushItem[]): Promise<{
  sent: number;
  failed: number;
  gone: string[];
}> {
  const vapid = configureWebPush();
  if (!vapid.ok) {
    const err = new Error(vapid.error);
    (err as Error & { status?: number }).status = 503;
    throw err;
  }

  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  for (const item of items) {
    const endpoint = String(item.endpoint || "").trim();
    const p256dh = String(item.p256dh || "").trim();
    const auth = String(item.auth || "").trim();
    const title = String(item.title || "").trim().slice(0, 120);
    const body = String(item.body || "").trim().slice(0, 500);
    if (!endpoint || !p256dh || !auth || !title || !body) {
      failed += 1;
      continue;
    }
    try {
      await webpush.sendNotification(
        { endpoint, keys: { p256dh, auth } },
        JSON.stringify({
          title,
          body,
          url: String(item.url || "/").slice(0, 200),
          tag: String(item.tag || "staff-desk").slice(0, 180),
        }),
      );
      sent += 1;
    } catch (err) {
      const statusCode =
        err && typeof err === "object" && "statusCode" in err
          ? Number((err as { statusCode?: number }).statusCode)
          : 0;
      if (statusCode === 404 || statusCode === 410) gone.push(endpoint);
      failed += 1;
    }
  }
  return { sent, failed, gone };
}
