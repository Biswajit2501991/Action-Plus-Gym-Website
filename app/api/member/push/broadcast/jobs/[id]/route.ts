import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";
import { authorizeInternalPushSecret } from "@/lib/member-portal/owner-broadcast";
import { deleteBroadcastJob } from "@/lib/member-portal/broadcast-jobs";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Hard-delete a scheduled broadcast job (pending / cancelled / sent / failed).
 * DELETE /api/member/push/broadcast/jobs/:id
 */
export async function DELETE(req: Request, ctx: Ctx) {
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
    const deleted = await deleteBroadcastJob(svc.client, gymId, id);
    return NextResponse.json({ ok: true, deleted: true, ...deleted });
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
        error: code || (err instanceof Error ? err.message : "delete-failed"),
        message: err instanceof Error ? err.message : "delete-failed",
      },
      { status },
    );
  }
}
