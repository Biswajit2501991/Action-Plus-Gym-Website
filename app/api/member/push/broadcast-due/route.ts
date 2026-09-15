import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";
import { authorizeInternalPushSecret } from "@/lib/member-portal/owner-broadcast";
import { processDueBroadcastJobs } from "@/lib/member-portal/broadcast-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron: claim and send due scheduled owner broadcasts.
 * Auth: Authorization: Bearer $MEMBER_PORTAL_CRON_SECRET
 *
 * Separate from billing-push cron — does not change billing_push_* settings.
 */
export async function POST(req: Request) {
  if (!authorizeInternalPushSecret(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
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
    const result = await processDueBroadcastJobs(svc.client, gymId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "broadcast-due-failed",
      },
      { status: 500 },
    );
  }
}
