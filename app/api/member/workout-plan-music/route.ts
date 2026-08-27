import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { loadMemberWorkoutPlanContext } from "@/lib/member-portal/workout-plan-settings";
import { loadActiveWorkoutPlanMusic } from "@/lib/member-portal/workout-plan-music";

export async function GET() {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json({ ok: false, error: session.error }, { status: session.status });
  }

  // Same eligibility as Workout Plan tile — music is only for members who can open Workout Plan.
  const ctx = await loadMemberWorkoutPlanContext(session.member.member_uuid);
  if (!ctx.ok) {
    return NextResponse.json({ ok: false, error: ctx.error }, { status: 500 });
  }
  if (!ctx.gate.visible) {
    return NextResponse.json({
      ok: true,
      eligible: false,
      music: null,
    });
  }

  const svc = createServiceRoleClient();
  const music = svc.ok
    ? await loadActiveWorkoutPlanMusic(svc.client, ctx.gymId)
    : null;

  return NextResponse.json(
    {
      ok: true,
      eligible: true,
      music,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
