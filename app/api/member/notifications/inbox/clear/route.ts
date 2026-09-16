import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";
import { clearAllInbox } from "@/lib/member-portal/notification-inbox";

export const dynamic = "force-dynamic";

/** Clear all inbox notifications for the logged-in member. */
export async function POST() {
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
    const cleared = await clearAllInbox(
      svc.client,
      gymId,
      session.member.member_uuid,
    );
    return NextResponse.json({ ok: true, cleared });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "clear-failed" },
      { status: 500 },
    );
  }
}
