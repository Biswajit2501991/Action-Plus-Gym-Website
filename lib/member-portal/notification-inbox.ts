/**
 * Member Portal in-app notification inbox (gym broadcasts).
 * Additive — separate from billing Alerts and push send_log.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const INBOX_TABLE = "member_portal_notification_inbox";
export const INBOX_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INBOX_DEFAULT_URL = "/members?inbox=1";

export type InboxItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string;
  readAt: string | null;
  createdAt: string;
  expiresAt: string;
};

function rowToItem(row: Record<string, unknown>): InboxItem {
  return {
    id: String(row.id || ""),
    kind: String(row.kind || "owner_broadcast"),
    title: String(row.title || ""),
    body: String(row.body || ""),
    url: String(row.url || INBOX_DEFAULT_URL),
    readAt: row.read_at ? String(row.read_at) : null,
    createdAt: String(row.created_at || ""),
    expiresAt: String(row.expires_at || ""),
  };
}

export function inboxExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + INBOX_TTL_MS).toISOString();
}

/**
 * Append one inbox row per recipient. Failures are logged but do not abort push.
 */
export async function insertBroadcastInboxRows(
  svc: SupabaseClient,
  opts: {
    gymId: string;
    memberUuids: string[];
    title: string;
    body: string;
    url?: string;
    sourceJobId?: string | null;
    kind?: string;
  },
): Promise<number> {
  const uuids = [...new Set((opts.memberUuids || []).map((u) => String(u || "").trim()).filter(Boolean))];
  if (!uuids.length) return 0;

  const expiresAt = inboxExpiresAt();
  const url = String(opts.url || INBOX_DEFAULT_URL).trim().slice(0, 200) || INBOX_DEFAULT_URL;
  const kind = String(opts.kind || "owner_broadcast").slice(0, 40);
  const title = String(opts.title || "").trim().slice(0, 120);
  const body = String(opts.body || "").trim().slice(0, 500);
  if (!title || !body) return 0;

  let inserted = 0;
  const chunkSize = 100;
  for (let i = 0; i < uuids.length; i += chunkSize) {
    const chunk = uuids.slice(i, i + chunkSize);
    const rows = chunk.map((member_uuid) => ({
      gym_id: opts.gymId,
      member_uuid,
      kind,
      title,
      body,
      url,
      source_job_id: opts.sourceJobId || null,
      expires_at: expiresAt,
    }));
    const { error, count } = await svc.from(INBOX_TABLE).insert(rows, { count: "exact" });
    if (error) {
      console.warn("[inbox] insert chunk failed:", error.message);
      continue;
    }
    inserted += typeof count === "number" ? count : chunk.length;
  }
  return inserted;
}

export async function purgeExpiredInbox(
  svc: SupabaseClient,
  gymId: string,
  memberUuid?: string,
): Promise<number> {
  const now = new Date().toISOString();
  let q = svc
    .from(INBOX_TABLE)
    .delete({ count: "exact" })
    .eq("gym_id", gymId)
    .lt("expires_at", now);
  if (memberUuid) q = q.eq("member_uuid", memberUuid);
  const { error, count } = await q;
  if (error) {
    console.warn("[inbox] purge failed:", error.message);
    return 0;
  }
  return Number(count) || 0;
}

export async function listMemberInbox(
  svc: SupabaseClient,
  gymId: string,
  memberUuid: string,
): Promise<{ items: InboxItem[]; unreadCount: number }> {
  await purgeExpiredInbox(svc, gymId, memberUuid);

  const now = new Date().toISOString();
  const { data, error } = await svc
    .from(INBOX_TABLE)
    .select("id, kind, title, body, url, read_at, created_at, expires_at")
    .eq("gym_id", gymId)
    .eq("member_uuid", memberUuid)
    .is("cleared_at", null)
    .gte("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  const items = (data || []).map((r) => rowToItem(r as Record<string, unknown>));
  const unreadCount = items.filter((i) => !i.readAt).length;
  return { items, unreadCount };
}

export async function markInboxRead(
  svc: SupabaseClient,
  gymId: string,
  memberUuid: string,
  ids: string[],
): Promise<number> {
  const list = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 50);
  if (!list.length) return 0;
  const now = new Date().toISOString();
  const { data, error } = await svc
    .from(INBOX_TABLE)
    .update({ read_at: now })
    .eq("gym_id", gymId)
    .eq("member_uuid", memberUuid)
    .in("id", list)
    .is("cleared_at", null)
    .is("read_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  return (data || []).length;
}

export async function clearAllInbox(
  svc: SupabaseClient,
  gymId: string,
  memberUuid: string,
): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await svc
    .from(INBOX_TABLE)
    .update({ cleared_at: now, read_at: now })
    .eq("gym_id", gymId)
    .eq("member_uuid", memberUuid)
    .is("cleared_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  return (data || []).length;
}
