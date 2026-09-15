import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";
import { authorizeInternalPushSecret } from "@/lib/member-portal/owner-broadcast";
import { cancelBroadcastJob } from "@/lib/member-portal/broadcast-jobs";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Cancel a pending scheduled broadcast.
 * POST /api/member/push/broadcast/jobs/:id/cancel
 */
export async function POST(req: Request, ctx: Ctx) {
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

  const { id } = await ctx.params;

  try {
    const job = await cancelBroadcastJob(svc.client, gymId, id);
    return NextResponse.json({ ok: true, job });
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status?: number }).status) || 500
        : 500;
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code || "")
        : "";
    return NextResponse.json(
      {
        ok: false,
        error: code || (err instanceof Error ? err.message : "cancel-failed"),
        message: err instanceof Error ? err.message : "cancel-failed",
      },
      { status },
    );
  }
}
