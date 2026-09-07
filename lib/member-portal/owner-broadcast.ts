/**
 * Owner gym-wide Web Push broadcast helpers.
 * Additive — does not touch billing-cron or member portal_enabled.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { configureWebPush, sendPushToMemberSubscriptions } from "@/lib/member-portal/billing-push";

export const OWNER_BROADCAST_KIND = "owner_broadcast";
export const OWNER_BROADCAST_COOLDOWN_MS = 5 * 60 * 1000;
export const OWNER_BROADCAST_TITLE_MAX = 120;
export const OWNER_BROADCAST_BODY_MAX = 500;

export function clampBroadcastTitle(raw: unknown): string {
  return String(raw || "")
    .trim()
    .slice(0, OWNER_BROADCAST_TITLE_MAX);
}

export function clampBroadcastBody(raw: unknown): string {
  return String(raw || "")
    .trim()
    .slice(0, OWNER_BROADCAST_BODY_MAX);
}

export function authorizeInternalPushSecret(req: Request): boolean {
  const secret = String(process.env.MEMBER_PORTAL_CRON_SECRET || "").trim();
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return Boolean(secret && token && token === secret);
}

/**
 * Active, portal-enabled, non-deleted members who have ≥1 push subscription.
 */
export async function listBroadcastRecipientUuids(
  svc: SupabaseClient,
  gymId: string,
): Promise<string[]> {
  const { data: subs, error: subErr } = await svc
    .from("member_portal_push_subscriptions")
    .select("member_uuid")
    .eq("gym_id", gymId);
  if (subErr) throw new Error(subErr.message);

  const uuids = [
    ...new Set(
      (subs || [])
        .map((r) => String((r as { member_uuid?: string }).member_uuid || "").trim())
        .filter(Boolean),
    ),
  ];
  if (!uuids.length) return [];

  const eligible: string[] = [];
  // Chunk to avoid URL length / PostgREST limits.
  const chunkSize = 200;
  for (let i = 0; i < uuids.length; i += chunkSize) {
    const chunk = uuids.slice(i, i + chunkSize);
    const { data: members, error } = await svc
      .from("members")
      .select("member_uuid, portal_enabled, status, deleted_at")
      .eq("gym_id", gymId)
      .in("member_uuid", chunk)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
    for (const m of members || []) {
      const row = m as {
        member_uuid?: string;
        portal_enabled?: boolean;
        status?: string;
      };
      const uuid = String(row.member_uuid || "").trim();
      if (!uuid) continue;
      if (row.portal_enabled === false) continue;
      if (String(row.status || "").trim().toLowerCase() !== "active") continue;
      eligible.push(uuid);
    }
  }
  return eligible;
}

export async function recentOwnerBroadcastAt(
  svc: SupabaseClient,
  gymId: string,
): Promise<Date | null> {
  const since = new Date(Date.now() - OWNER_BROADCAST_COOLDOWN_MS).toISOString();
  const { data, error } = await svc
    .from("member_portal_push_send_log")
    .select("created_at")
    .eq("gym_id", gymId)
    .eq("kind", OWNER_BROADCAST_KIND)
    .eq("success", true)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const raw = data?.[0] ? String((data[0] as { created_at?: string }).created_at || "") : "";
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function runOwnerBroadcast(
  svc: SupabaseClient,
  opts: {
    gymId: string;
    title: string;
    body: string;
    url?: string;
  },
): Promise<{
  recipients: number;
  membersSent: number;
  membersFailed: number;
  pushSent: number;
  pushFailed: number;
}> {
  const vapid = configureWebPush();
  if (!vapid.ok) {
    throw Object.assign(new Error(vapid.error), { status: 503, code: vapid.error });
  }

  const title = clampBroadcastTitle(opts.title);
  const body = clampBroadcastBody(opts.body);
  if (!title || !body) {
    throw Object.assign(new Error("title-and-body-required"), {
      status: 400,
      code: "title-and-body-required",
    });
  }

  const recent = await recentOwnerBroadcastAt(svc, opts.gymId);
  if (recent) {
    const waitMs = OWNER_BROADCAST_COOLDOWN_MS - (Date.now() - recent.getTime());
    throw Object.assign(
      new Error(
        `Please wait ${Math.max(1, Math.ceil(waitMs / 1000))}s before another gym-wide broadcast.`,
      ),
      { status: 429, code: "broadcast-cooldown" },
    );
  }

  const recipients = await listBroadcastRecipientUuids(svc, opts.gymId);
  let membersSent = 0;
  let membersFailed = 0;
  let pushSent = 0;
  let pushFailed = 0;

  for (const memberUuid of recipients) {
    const result = await sendPushToMemberSubscriptions(svc, {
      gymId: opts.gymId,
      memberUuid,
      title,
      body,
      url: opts.url || "/members",
      kind: OWNER_BROADCAST_KIND,
      tag: OWNER_BROADCAST_KIND,
      log: true,
    });
    pushSent += result.sent;
    pushFailed += result.failed;
    if (result.sent > 0) membersSent += 1;
    else membersFailed += 1;
  }

  return {
    recipients: recipients.length,
    membersSent,
    membersFailed,
    pushSent,
    pushFailed,
  };
}
