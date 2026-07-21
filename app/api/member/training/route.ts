import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";

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
  const uuid = session.member.member_uuid;

  const [pt, workouts, diets, measurements] = await Promise.all([
    svc.client
      .from("member_pt_assignments")
      .select("*")
      .eq("gym_id", gymId)
      .eq("member_uuid", uuid)
      .order("created_at", { ascending: false })
      .limit(10),
    svc.client
      .from("member_workout_plans")
      .select("id, title, content_json, assigned_by, is_active, created_at")
      .eq("gym_id", gymId)
      .eq("member_uuid", uuid)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10),
    svc.client
      .from("member_diet_plans")
      .select("id, title, content_json, assigned_by, is_active, created_at")
      .eq("gym_id", gymId)
      .eq("member_uuid", uuid)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10),
    svc.client
      .from("member_measurements")
      .select("id, measured_at, weight_kg, body_fat_pct, notes, metrics_json")
      .eq("gym_id", gymId)
      .eq("member_uuid", uuid)
      .order("measured_at", { ascending: false })
      .limit(24),
  ]);

  return NextResponse.json({
    ok: true,
    pt: pt.data || [],
    workouts: workouts.data || [],
    diets: diets.data || [],
    measurements: measurements.data || [],
  });
}
