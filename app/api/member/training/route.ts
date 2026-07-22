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
  sessions?: number | string | Array<Record<string, unknown>>;
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

/** Only treat sessions as a package quota when it is a positive number (not a log array). */
function packageSessionTotal(sessions: PlanJson["sessions"]): number | null {
  if (typeof sessions === "number" && Number.isFinite(sessions) && sessions > 0) {
    return sessions;
  }
  if (typeof sessions === "string" && /^\d+(\.\d+)?$/.test(sessions.trim())) {
    const n = Number(sessions.trim());
    return n > 0 ? n : null;
  }
  return null;
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

  let focusByDate: Record<string, string> = {};
  let ptWorkoutNotes = "";
  const today = todayKeyIndia();

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
    focusByDate =
      planJson.focusByDate && typeof planJson.focusByDate === "object"
        ? Object.fromEntries(
            Object.entries(planJson.focusByDate).map(([k, v]) => [
              String(k),
              String(v || "").trim(),
            ]),
          )
        : {};
    const todayFocus = String(focusByDate[today] || "").trim();
    const workoutPlanText = String(planJson.workoutPlan || "").trim();
    const focusArea = String(planJson.focusArea || "").trim();
    const dietPlanText = String(planJson.dietPlan || "").trim();
    ptWorkoutNotes = String(planJson.ptWorkoutNotes || "").trim();
    const scheduledDays = Object.values(focusByDate).filter(Boolean).length;
    const sessionsTotal = packageSessionTotal(planJson.sessions);

    if (onPtPlan || trainerName || scheduledDays || workoutPlanText) {
      // Prefer Gym Manager PT row over empty Phase 2 stubs (avoids fake 0/— sessions).
      pt = [
        {
          id: profileRow?.id || `gm-pt-${member.id}`,
          trainer_name: trainerName || "Assigned trainer",
          plan_name: planName || null,
          scheduled_days: scheduledDays,
          sessions_used: null,
          sessions_total: sessionsTotal,
          source: "pt_client_profiles",
        },
        ...pt.filter((row) => String(row?.source || "") !== "pt_client_profiles"),
      ];
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
      if (ptWorkoutNotes) {
        rows.push({
          id: `pt-notes-${member.id}`,
          title: ptWorkoutNotes,
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

  const [dailyRes, exerciseRes] = await Promise.all([
    svc.client
      .from("member_daily_workouts")
      .select("workout_date, exercises, notes, source, updated_at")
      .eq("gym_id", gymId)
      .eq("member_uuid", uuid)
      .order("workout_date", { ascending: false })
      .limit(400),
    svc.client
      .from("settings_lookup_values")
      .select("value")
      .eq("gym_id", gymId)
      .eq("category", "exerciseTypes")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(100),
  ]);

  const dailyByDate: Record<
    string,
    { exercises: string[]; notes: string; source?: string }
  > = {};
  for (const row of dailyRes.data || []) {
    const key = String(row.workout_date).slice(0, 10);
    dailyByDate[key] = {
      exercises: Array.isArray(row.exercises) ? row.exercises.map(String) : [],
      notes: String(row.notes || ""),
      source: row.source ? String(row.source) : undefined,
    };
  }

  const exerciseTypes = [
    ...new Set(
      (exerciseRes.data || [])
        .map((r: { value?: string }) => String(r.value || "").trim())
        .filter(Boolean),
    ),
  ];
  if (!exerciseTypes.length) {
    exerciseTypes.push(...DEFAULT_EXERCISE_TYPES);
  }

  return NextResponse.json({
    ok: true,
    today,
    focusByDate,
    ptWorkoutNotes,
    pt,
    workouts,
    diets,
    measurements: measurements.data || [],
    dailyByDate,
    exerciseTypes,
  });
}

const DEFAULT_EXERCISE_TYPES = [
  "Back",
  "Chest",
  "Legs",
  "Shoulder",
  "Cardio",
  "Freehand + Cardio",
  "Yoga",
  "Running",
  "Rest day",
  "Full Body",
];

function normalizeExercises(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const label = String(raw || "").trim().slice(0, 80);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= 20) break;
  }
  return out;
}

export async function POST(req: Request) {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  const status = String(session.member.status || "").trim().toLowerCase();
  if (status === "deactivated" || status === "cancelled") {
    return NextResponse.json(
      { ok: false, error: "Membership is not active for workout logging." },
      { status: 403 },
    );
  }

  let body: { workoutDate?: string; exercises?: string[]; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const workoutDate = String(body.workoutDate || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workoutDate)) {
    return NextResponse.json(
      { ok: false, error: "workoutDate must be YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const exercises = normalizeExercises(body.exercises);
  const notes = String(body.notes || "").trim().slice(0, 1000);

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const gymId = portalGymId();
  const uuid = session.member.member_uuid;

  if (!exercises.length && !notes) {
    const { error } = await svc.client
      .from("member_daily_workouts")
      .delete()
      .eq("gym_id", gymId)
      .eq("member_uuid", uuid)
      .eq("workout_date", workoutDate);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, cleared: true, workoutDate });
  }

  const { data, error } = await svc.client
    .from("member_daily_workouts")
    .upsert(
      {
        gym_id: gymId,
        member_uuid: uuid,
        workout_date: workoutDate,
        exercises,
        notes,
        recorded_by: "member",
        source: "portal",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "gym_id,member_uuid,workout_date" },
    )
    .select("id, workout_date, exercises, notes, source, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: data });
}
