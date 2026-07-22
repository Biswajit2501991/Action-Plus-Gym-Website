import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";

/**
 * Lightweight unread check for staff replies.
 * Does not create threads or mutate member rows.
 */
export async function GET() {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const gymId = portalGymId();
  const memberUuid = session.member.member_uuid;

  const { data: threads, error: tErr } = await svc.client
    .from("member_portal_chat_threads")
    .select("id")
    .eq("gym_id", gymId)
    .eq("member_uuid", memberUuid)
    .limit(50);

  if (tErr) {
    return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
  }

  const ids = (threads || []).map((t: { id: string }) => t.id);
  if (!ids.length) {
    return NextResponse.json({
      ok: true,
      hasStaffMessages: false,
      latestStaffAt: null,
      latestStaffId: null,
      latestStaffAtMs: null,
      memberUuid,
    });
  }

  // Prefer array + [0] over maybeSingle — maybeSingle can error with order/limit.
  const { data: rows, error } = await svc.client
    .from("member_portal_chat_messages")
    .select("id, created_at")
    .eq("gym_id", gymId)
    .in("thread_id", ids)
    .eq("sender", "staff")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const latest = Array.isArray(rows) && rows.length ? rows[0] : null;
  const latestStaffAt = latest?.created_at || null;
  let latestStaffAtMs: number | null = null;
  if (latestStaffAt) {
    const normalized = String(latestStaffAt).includes("T")
      ? String(latestStaffAt)
      : String(latestStaffAt)
          .replace(" ", "T")
          .replace(/\+00$/, "Z")
          .replace(/(\.\d+)?\+00:00$/, "Z");
    const ms = Date.parse(normalized);
    latestStaffAtMs = Number.isFinite(ms) ? ms : null;
  }

  return NextResponse.json({
    ok: true,
    hasStaffMessages: Boolean(latestStaffAt),
    latestStaffAt,
    latestStaffId: latest?.id || null,
    latestStaffAtMs,
    memberUuid,
  });
}
