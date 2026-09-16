import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";
import { markInboxRead } from "@/lib/member-portal/notification-inbox";

export const dynamic = "force-dynamic";

/** Mark one or more inbox notifications as read. */
export async function POST(req: Request) {
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

  let body: { ids?: string[]; id?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const ids = Array.isArray(body.ids)
    ? body.ids
    : body.id
      ? [body.id]
      : [];

  try {
    const updated = await markInboxRead(
      svc.client,
      gymId,
      session.member.member_uuid,
      ids,
    );
    return NextResponse.json({ ok: true, updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "mark-read-failed" },
      { status: 500 },
    );
  }
}
