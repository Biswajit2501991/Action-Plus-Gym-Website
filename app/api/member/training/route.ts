import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";

type PlanJson = {
  trainerId?: string;
  trainer?: string;
  workoutPlan?: string;
  focusArea?: string;
  focusByDate?: Record<string, string>;
  dietPlan?: string;
  calories?: string;
  protein?: string;
  water?: string;
  sessions?: number | string;
  ptWorkoutNotes?: string;
};

/** Gym runs in India — schedule keys are local calendar dates. */
function todayKeyIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isPtPlanName(planName: string | null | undefined) {
  return /\bpt\b/i.test(String(planName || "").trim());
}

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

  const { data: member, error: memberErr } = await svc.client
    .from("members")
    .select("id, member_code, plan_name, status")
    .eq("gym_id", gymId)
    .eq("member_uuid", uuid)
    .maybeSingle();

  if (memberErr) {
    return NextResponse.json(
      { ok: false, error: memberErr.message || "member-lookup-failed" },
      { status: 500 },
    );
  }

  // Keep Phase 2 stub tables as optional extras (never overwrite GM PT source of truth).
  const [ptStub, workoutsStub, dietsStub, measurements] = await Promise.all([
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

  let pt: Array<Record<string, unknown>> = Array.isArray(ptStub.data)
    ? [...ptStub.data]
    : [];
  let workouts: Array<Record<string, unknown>> = Array.isArray(workoutsStub.data)
    ? [...workoutsStub.data]
    : [];
  let diets: Array<Record<string, unknown>> = Array.isArray(dietsStub.data)
    ? [...dietsStub.data]
    : [];

  // Source of truth for Gym Manager PT Clients: pt_client_profiles.plan_json
  if (member?.id) {
    const { data: profileRow } = await svc.client
      .from("pt_client_profiles")
      .select("id, trainer_staff_code, plan_json, updated_at")
      .eq("gym_id", gymId)
      .eq("member_id", member.id)
      .maybeSingle();

    const planJson =
      profileRow?.plan_json && typeof profileRow.plan_json === "object"
        ? (profileRow.plan_json as PlanJson)
        : ({} as PlanJson);

    const trainerName = String(
      planJson.trainerId ||
        planJson.trainer ||
        profileRow?.trainer_staff_code ||
        "",
    ).trim();
    const planName = String(member.plan_name || "").trim();
    const onPtPlan = isPtPlanName(planName);
    const focusByDate =
      planJson.focusByDate && typeof planJson.focusByDate === "object"
        ? planJson.focusByDate
        : {};
    const today = todayKeyIndia();
    const todayFocus = String(focusByDate[today] || "").trim();
    const workoutPlanText = String(planJson.workoutPlan || "").trim();
    const focusArea = String(planJson.focusArea || "").trim();
    const dietPlanText = String(planJson.dietPlan || "").trim();
    const notes = String(planJson.ptWorkoutNotes || "").trim();

    if (onPtPlan || trainerName || Object.keys(focusByDate).length || workoutPlanText) {
      const sessionsRaw = planJson.sessions;
      const sessionsTotal =
        sessionsRaw != null && String(sessionsRaw).trim() !== ""
          ? Number(sessionsRaw) || String(sessionsRaw)
          : null;

      if (pt.length === 0) {
        pt = [
          {
            id: profileRow?.id || `gm-pt-${member.id}`,
            trainer_name: trainerName || "Assigned trainer",
            plan_name: planName || null,
            sessions_used: null,
            sessions_total: sessionsTotal,
            source: "pt_client_profiles",
          },
        ];
      }
    }

    if (workouts.length === 0) {
      const rows: Array<Record<string, unknown>> = [];
      if (todayFocus) {
        rows.push({
          id: `focus-${today}`,
          title: `Today’s focus: ${todayFocus}`,
          kind: "focus_today",
          date: today,
        });
      }
      if (workoutPlanText) {
        rows.push({
          id: `workout-plan-${member.id}`,
          title: workoutPlanText,
          kind: "workout_plan",
        });
      } else if (!todayFocus && focusArea) {
        rows.push({
          id: `focus-area-${member.id}`,
          title: `Focus: ${focusArea}`,
          kind: "focus_area",
        });
      }
      if (notes) {
        rows.push({
          id: `pt-notes-${member.id}`,
          title: notes,
          kind: "notes",
        });
      }
      workouts = rows;
    }

    if (diets.length === 0 && dietPlanText) {
      const macros = [
        planJson.calories ? `${planJson.calories} kcal` : "",
        planJson.protein ? `${planJson.protein} protein` : "",
        planJson.water ? `${planJson.water} water` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      diets = [
        {
          id: `diet-${member.id}`,
          title: macros ? `${dietPlanText} (${macros})` : dietPlanText,
          kind: "diet_plan",
        },
      ];
    }
  }

  return NextResponse.json({
    ok: true,
    pt,
    workouts,
    diets,
    measurements: measurements.data || [],
  });
}
