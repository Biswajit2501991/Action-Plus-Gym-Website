import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  auditLog,
  clearAuthCookies,
  requestMeta,
  requireMemberSession,
} from "@/lib/member-portal/session";

export async function POST(req: NextRequest) {
  const { ip, userAgent } = requestMeta(req);
  const session = await requireMemberSession();

  if (session.ok) {
    const svc = createServiceRoleClient();
    if (svc.ok) {
      await svc.client
        .from("member_portal_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", session.claims.sid)
        .is("revoked_at", null);
    }
    await auditLog({
      memberUuid: session.claims.mid,
      eventType: "logout",
      ip,
      userAgent,
    });
  }

  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
