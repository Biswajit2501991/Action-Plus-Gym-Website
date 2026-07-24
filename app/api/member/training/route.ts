import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { portalGymId, PORTAL_MEMBERSHIP_STATUS_ERROR, isPortalAllowedMembershipStatus } from "@/lib/member-portal/config";
import {
  normalizePortalSections,
  portalSectionsFromSettings,
  visibleBasicWorkoutLabels,
  type PortalSections,
} from "@/lib/member-portal/portal-ui-config";
import { fetchExerciseTypeLookupValues } from "@/lib/member-portal/portal-home-tile-markers";

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

function scheduledFocusMap(
  focusByDate: Record<string, string>,
  revealFocus: boolean,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(focusByDate)) {
    const focus = String(v || "").trim();
    if (!focus) continue;
    out[k] = revealFocus ? focus : "scheduled";
  }
  return out;
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

  const planNameLive = String(member?.plan_name || "").trim();
  const onPtPlan = isPtPlanName(planNameLive);

  const [{ data: portalSettingsRow }, exerciseTypesLookup] = await Promise.all([
    svc.client
      .from("member_portal_settings")
      .select("basic_workout_options, portal_sections")
      .eq("gym_id", gymId)
      .maybeSingle(),
    fetchExerciseTypeLookupValues(svc.client),
  ]);

  const portalSections: PortalSections = portalSectionsFromSettings({
    portal_sections: portalSettingsRow?.portal_sections,
    basic_workout_options: portalSettingsRow?.basic_workout_options,
    exerciseTypes: exerciseTypesLookup,
  });
  const basicExerciseTypes = visibleBasicWorkoutLabels(
    portalSettingsRow?.basic_workout_options,
  );

  /** Basic members may log workouts when section enabled; PT may add notes only when enabled. */
  const canEditWorkouts =
    !onPtPlan && portalSections.basicDailyWorkouts;
  const canEditNotes = onPtPlan
    ? portalSections.ptMemberNotes
    : portalSections.basicNotes;
  const canEditPtNotes = onPtPlan && portalSections.ptMemberNotes;

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
    const rawFocusByDate =
      planJson.focusByDate && typeof planJson.focusByDate === "object"
        ? Object.fromEntries(
            Object.entries(planJson.focusByDate).map(([k, v]) => [
              String(k),
              String(v || "").trim(),
            ]),
          )
        : {};
    focusByDate = scheduledFocusMap(
      rawFocusByDate,
      onPtPlan && portalSections.ptWorkoutDetails,
    );
    const todayFocus = String(rawFocusByDate[today] || "").trim();
    const workoutPlanText = String(planJson.workoutPlan || "").trim();
    const focusArea = String(planJson.focusArea || "").trim();
    const dietPlanText = String(planJson.dietPlan || "").trim();
    ptWorkoutNotes = String(planJson.ptWorkoutNotes || "").trim();
    const scheduledDays = Object.values(rawFocusByDate).filter(Boolean).length;
    const sessionsTotal = packageSessionTotal(planJson.sessions);

    // Only surface PT assignment while the member is on a PT plan (profile data stays in DB).
    if (
      onPtPlan &&
      portalSections.ptAssignment &&
      (trainerName || scheduledDays || workoutPlanText || todayFocus)
    ) {
      pt = [
        {
          id: profileRow?.id || `gm-pt-${member.id}`,
          trainer_name: trainerName || "Assigned trainer",
          plan_name: planNameLive || null,
          scheduled_days: scheduledDays,
          sessions_used: null,
          sessions_total: sessionsTotal,
          source: "pt_client_profiles",
        },
        ...pt.filter((row) => String(row?.source || "") !== "pt_client_profiles"),
      ];
    } else if (!onPtPlan || !portalSections.ptAssignment) {
      pt = [];
    }

    // Trainer schedule / diet / notes: expose only while on PT.
    if (!onPtPlan) {
      focusByDate = {};
      ptWorkoutNotes = "";
    }

    if (onPtPlan && portalSections.ptWorkoutDetails && workouts.length === 0) {
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
    } else if (onPtPlan && !portalSections.ptWorkoutDetails) {
      // Hide trainer focus / plan text from PT clients (days calendar only).
      workouts = [];
      ptWorkoutNotes = "";
    }

    if (onPtPlan && portalSections.ptDiet && diets.length === 0 && dietPlanText) {
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
    } else if (onPtPlan && !portalSections.ptDiet) {
      diets = [];
    }

    if (!onPtPlan) {
      // Hide trainer-managed PT UI for basic plans; pt_client_profiles rows stay in DB.
      pt = [];
    }
  }

  const dailyRes = await svc.client
    .from("member_daily_workouts")
    .select("workout_date, exercises, notes, source, updated_at")
    .eq("gym_id", gymId)
    .eq("member_uuid", uuid)
    .order("workout_date", { ascending: false })
    .limit(400);

  const dailyByDate: Record<
    string,
    { exercises: string[]; notes: string; source?: string }
  > = {};
  for (const row of dailyRes.data || []) {
    const key = String(row.workout_date).slice(0, 10);
    const exercises = Array.isArray(row.exercises)
      ? row.exercises.map(String)
      : [];
    // PT clients: never surface trainer/logged exercise chips — notes only.
    dailyByDate[key] = {
      exercises: onPtPlan ? [] : exercises,
      notes: String(row.notes || ""),
      source: row.source ? String(row.source) : undefined,
    };
  }

  // Portal PT calendar previously only used trainer focusByDate. Staff often
  // schedule days via Gym Manager Workout (member_daily_workouts). Union those
  // logged days into the calendar/count so members see the same PT days.
  if (onPtPlan && portalSections.ptSchedule) {
    const revealFocus = portalSections.ptWorkoutDetails;
    for (const row of dailyRes.data || []) {
      const key = String(row.workout_date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
      const exercises = Array.isArray(row.exercises)
        ? row.exercises.map(String).filter(Boolean)
        : [];
      if (!exercises.length) continue;
      if (String(focusByDate[key] || "").trim()) continue;
      focusByDate[key] = revealFocus
        ? String(exercises[0] || "Workout").trim() || "Workout"
        : "scheduled";
    }

    const scheduledDays = Object.values(focusByDate).filter((v) =>
      Boolean(String(v || "").trim()),
    ).length;
    if (portalSections.ptAssignment && scheduledDays > 0) {
      const hasGmPt = pt.some(
        (row) => String(row?.source || "") === "pt_client_profiles",
      );
      if (hasGmPt) {
        pt = pt.map((row) =>
          String(row?.source || "") === "pt_client_profiles"
            ? { ...row, scheduled_days: scheduledDays }
            : row,
        );
      } else if (member?.id) {
        pt = [
          {
            id: `gm-pt-${member.id}`,
            trainer_name: "Assigned trainer",
            plan_name: planNameLive || null,
            scheduled_days: scheduledDays,
            sessions_used: null,
            sessions_total: null,
            source: "pt_client_profiles",
          },
          ...pt,
        ];
      }
    }
  }

  const exerciseTypes = onPtPlan ? [] : basicExerciseTypes;

  return NextResponse.json({
    ok: true,
    today,
    planName: planNameLive || null,
    onPtPlan,
    canEditWorkouts,
    canEditNotes,
    canEditPtNotes,
    focusByDate,
    ptWorkoutNotes: portalSections.ptWorkoutDetails ? ptWorkoutNotes : "",
    pt: portalSections.ptAssignment ? pt : [],
    workouts: onPtPlan && !portalSections.ptWorkoutDetails ? [] : workouts,
    diets: onPtPlan && !portalSections.ptDiet ? [] : diets,
    measurements: portalSections.measurements ? measurements.data || [] : [],
    showMeasurements: portalSections.measurements,
    showPtSchedule: portalSections.ptSchedule,
    showPtWorkoutDetails: portalSections.ptWorkoutDetails,
    portalSections,
    dailyByDate,
    exerciseTypes,
  });
}

function normalizeExercises(input: unknown, allowed?: string[]): string[] {
  if (!Array.isArray(input)) return [];
  const allow =
    allowed && allowed.length
      ? new Set(allowed.map((x) => x.toLowerCase()))
      : null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const label = String(raw || "").trim().slice(0, 80);
    if (!label) continue;
    const key = label.toLowerCase();
    if (allow && !allow.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    // Prefer canonical casing from allowed list when present.
    const canonical =
      allowed?.find((a) => a.toLowerCase() === key) || label;
    out.push(canonical);
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

  const notes = String(body.notes || "").trim().slice(0, 1000);

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const gymId = portalGymId();
  const uuid = session.member.member_uuid;

  // Fresh plan/status from DB so plan switches take effect immediately.
  const { data: memberLive, error: memberErr } = await svc.client
    .from("members")
    .select("id, plan_name, status")
    .eq("gym_id", gymId)
    .eq("member_uuid", uuid)
    .maybeSingle();
  if (memberErr) {
    return NextResponse.json(
      { ok: false, error: memberErr.message || "member-lookup-failed" },
      { status: 500 },
    );
  }

  const status = String(memberLive?.status || session.member.status || "")
    .trim()
    .toLowerCase();
  if (!isPortalAllowedMembershipStatus(status)) {
    return NextResponse.json(
      { ok: false, error: PORTAL_MEMBERSHIP_STATUS_ERROR },
      { status: 403 },
    );
  }

  const { data: portalSettingsRow } = await svc.client
    .from("member_portal_settings")
    .select("basic_workout_options, portal_sections")
    .eq("gym_id", gymId)
    .maybeSingle();
  const portalSections = normalizePortalSections(
    portalSettingsRow?.portal_sections,
  );
  const allowedBasic = visibleBasicWorkoutLabels(
    portalSettingsRow?.basic_workout_options,
  );

  const onPtPlan = isPtPlanName(memberLive?.plan_name);

  if (onPtPlan) {
    if (!portalSections.ptMemberNotes) {
      return NextResponse.json(
        { ok: false, error: "Notes are not enabled for PT clients." },
        { status: 403 },
      );
    }

    // PT clients may add notes on any calendar day (PT or open).
    // Staff-logged exercises are preserved; portal never sets exercise chips.

    // PT clients: notes only — preserve any staff-logged exercises; never set chips from portal.
    const { data: existingRow } = await svc.client
      .from("member_daily_workouts")
      .select("id, exercises, notes, source")
      .eq("gym_id", gymId)
      .eq("member_uuid", uuid)
      .eq("workout_date", workoutDate)
      .maybeSingle();

    const existingExercises = Array.isArray(existingRow?.exercises)
      ? existingRow.exercises.map(String).filter(Boolean)
      : [];

    if (!notes) {
      if (existingExercises.length) {
        // Keep staff workout row; only clear member notes.
        const { data, error } = await svc.client
          .from("member_daily_workouts")
          .upsert(
            {
              gym_id: gymId,
              member_uuid: uuid,
              workout_date: workoutDate,
              exercises: existingExercises,
              notes: "",
              recorded_by: existingRow?.source === "gym_manager" ? "staff" : "member",
              source: existingRow?.source || "portal",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "gym_id,member_uuid,workout_date" },
          )
          .select("id, workout_date, exercises, notes, source, updated_at")
          .maybeSingle();
        if (error) {
          return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }
        return NextResponse.json({ ok: true, item: data, clearedNotes: true });
      }
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
          exercises: existingExercises,
          notes,
          recorded_by: "member",
          source: existingRow?.source === "gym_manager" ? "gym_manager" : "portal",
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

  if (!portalSections.basicDailyWorkouts && !portalSections.basicNotes) {
    return NextResponse.json(
      { ok: false, error: "Workout logging is not enabled." },
      { status: 403 },
    );
  }

  // Preserve labels already on this day even if gym later hid that option.
  const { data: existingBasic } = await svc.client
    .from("member_daily_workouts")
    .select("exercises, notes")
    .eq("gym_id", gymId)
    .eq("member_uuid", uuid)
    .eq("workout_date", workoutDate)
    .maybeSingle();
  const historical = Array.isArray(existingBasic?.exercises)
    ? existingBasic.exercises.map(String).filter(Boolean)
    : [];
  const allowList = [...new Set([...allowedBasic, ...historical])];

  const exercises = portalSections.basicDailyWorkouts
    ? normalizeExercises(body.exercises, allowList)
    : historical;
  const notesToSave = portalSections.basicNotes
    ? notes
    : String(existingBasic?.notes || "");

  if (!exercises.length && !notesToSave) {
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
        notes: notesToSave,
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
