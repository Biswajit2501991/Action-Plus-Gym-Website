import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";
import { listMemberInbox } from "@/lib/member-portal/notification-inbox";

export const dynamic = "force-dynamic";

/** Member session: list in-app broadcast inbox (excludes cleared + expired). */
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
  if (!gymId) {
    return NextResponse.json({ ok: false, error: "gym-missing" }, { status: 500 });
  }

  try {
    const { items, unreadCount } = await listMemberInbox(
      svc.client,
      gymId,
      session.member.member_uuid,
    );
    return NextResponse.json({ ok: true, items, unreadCount });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "inbox-list-failed" },
      { status: 500 },
    );
  }
}
