import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";
import { loadMemberWorkoutPlanContext } from "@/lib/member-portal/workout-plan-settings";

const TABLE = "portal_workout_music";

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
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }
  const gymId = portalGymId();
  const { data, error } = await svc.client
    .from(TABLE)
    .select("title, mp4_url, is_active")
    .eq("gym_id", gymId)
    .maybeSingle();

  if (error) {
    // Table missing / not migrated yet — hide icon, do not break Workout Plan.
    return NextResponse.json({
      ok: true,
      eligible: true,
      music: null,
    });
  }

  const mp4Url = String(data?.mp4_url || "").trim();
  const active = data?.is_active !== false;
  if (!active || !mp4Url) {
    return NextResponse.json({
      ok: true,
      eligible: true,
      music: null,
    });
  }

  return NextResponse.json(
    {
      ok: true,
      eligible: true,
      music: {
        title: String(data?.title || "Gym music").trim() || "Gym music",
        mp4Url,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
