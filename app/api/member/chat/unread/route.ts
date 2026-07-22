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

  const { data: threads } = await svc.client
    .from("member_portal_chat_threads")
    .select("id")
    .eq("gym_id", gymId)
    .eq("member_uuid", memberUuid)
    .limit(20);

  const ids = (threads || []).map((t: { id: string }) => t.id);
  if (!ids.length) {
    return NextResponse.json({
      ok: true,
      hasStaffMessages: false,
      latestStaffAt: null,
      memberUuid,
    });
  }

  const { data: latest, error } = await svc.client
    .from("member_portal_chat_messages")
    .select("id, created_at")
    .eq("gym_id", gymId)
    .in("thread_id", ids)
    .eq("sender", "staff")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    hasStaffMessages: Boolean(latest?.created_at),
    latestStaffAt: latest?.created_at || null,
    latestStaffId: latest?.id || null,
    memberUuid,
  });
}
