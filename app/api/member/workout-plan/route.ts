import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { loadMemberWorkoutPlanContext } from "@/lib/member-portal/workout-plan-settings";
import {
  attachWorkoutVideos,
  loadWorkoutExerciseMediaMap,
} from "@/lib/member-portal/workout-plan-media";
import {
  loadWorkoutDayExtras,
  mergeProgramDayExtras,
} from "@/lib/member-portal/workout-plan-day-extras";
import {
  getWorkoutProgram,
  SHARED_PROGRESSION,
  TRAINER_NOTE,
  WORKOUT_LEVELS,
  type WorkoutLevel,
} from "@/lib/member-portal/workout-programs";

const PROGRESS_TABLE = "member_workout_program_progress";

function todayIst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseLevel(input: unknown): WorkoutLevel | null {
  const v = String(input || "").trim().toLowerCase();
  if (v === "beginner" || v === "intermediate" || v === "advanced") return v;
  return null;
}

type Completions = Record<
  string,
  { dayId: string; exercisesDone: string[]; dayComplete: boolean }
>;

async function loadProgress(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (t: string) => any },
  gymId: string,
  memberUuid: string,
) {
  const { data, error } = await client
    .from(PROGRESS_TABLE)
    .select("level, program_version, started_at, current_week, completions, updated_at")
    .eq("gym_id", gymId)
    .eq("member_uuid", memberUuid)
    .maybeSingle();
  if (error) return null;
  return data as {
    level?: string | null;
    program_version?: string | null;
    started_at?: string | null;
    current_week?: number | null;
    completions?: Completions | null;
  } | null;
}

export async function GET() {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json({ ok: false, error: session.error }, { status: session.status });
  }

  const ctx = await loadMemberWorkoutPlanContext(session.member.member_uuid);
  if (!ctx.ok) {
    return NextResponse.json({ ok: false, error: ctx.error }, { status: 500 });
  }

  if (!ctx.gate.visible) {
    return NextResponse.json({
      ok: true,
      eligible: false,
      reason: ctx.gate.reason,
      levels: WORKOUT_LEVELS,
    });
  }

  const svc = createServiceRoleClient();
  const progress = svc.ok
    ? await loadProgress(svc.client, ctx.gymId, session.member.member_uuid)
    : null;
  const level = parseLevel(progress?.level);
  const rawProgram = level ? getWorkoutProgram(level) : null;
  const extras =
    rawProgram && svc.ok
      ? await loadWorkoutDayExtras(svc.client, ctx.gymId, level as string)
      : [];
  const mergedProgram = rawProgram ? mergeProgramDayExtras(rawProgram, extras) : null;
  const mediaByKey = await loadWorkoutExerciseMediaMap(
    svc.ok ? svc.client : null,
    ctx.gymId,
  );
  const program = mergedProgram ? attachWorkoutVideos(mergedProgram, mediaByKey) : null;

  return NextResponse.json(
    {
      ok: true,
      eligible: true,
      reason: null,
      member: { name: ctx.member.fullName, trainerLabel: "Self" },
      levels: WORKOUT_LEVELS,
      activeLevel: level,
      videos: mediaByKey,
      program: program
        ? { ...program, progression: SHARED_PROGRESSION, trainerNote: TRAINER_NOTE }
        : null,
      progress: {
        startedAt: progress?.started_at || null,
        currentWeek: Number(progress?.current_week) || 1,
        completions:
          progress?.completions && typeof progress.completions === "object"
            ? progress.completions
            : {},
      },
      today: todayIst(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json({ ok: false, error: session.error }, { status: session.status });
  }

  const ctx = await loadMemberWorkoutPlanContext(session.member.member_uuid);
  if (!ctx.ok) {
    return NextResponse.json({ ok: false, error: ctx.error }, { status: 500 });
  }
  if (!ctx.gate.visible) {
    return NextResponse.json(
      { ok: false, error: "forbidden", reason: ctx.gate.reason },
      { status: 403 },
    );
  }

  let body: {
    action?: string;
    level?: string;
    dayId?: string;
    exerciseKey?: string;
    date?: string;
    dayComplete?: boolean;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const existing = await loadProgress(svc.client, ctx.gymId, session.member.member_uuid);
  const completions: Completions =
    existing?.completions && typeof existing.completions === "object"
      ? { ...existing.completions }
      : {};
  let level = parseLevel(body.level) || parseLevel(existing?.level);
  const action = String(body.action || "progress").trim();

  if (action === "level" || action === "selectLevel") {
    const next = parseLevel(body.level);
    if (!next) return NextResponse.json({ ok: false, error: "invalid-level" }, { status: 400 });
    level = next;
  }

  if (!level) {
    return NextResponse.json({ ok: false, error: "level-required" }, { status: 400 });
  }

  const programBase = getWorkoutProgram(level);
  if (!programBase) {
    return NextResponse.json({ ok: false, error: "unknown-program" }, { status: 400 });
  }
  const extras = await loadWorkoutDayExtras(svc.client, ctx.gymId, level);
  const program = mergeProgramDayExtras(programBase, extras);

  if (action === "progress") {
    const date = String(body.date || todayIst()).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ ok: false, error: "invalid-date" }, { status: 400 });
    }
    const dayId = String(body.dayId || "").trim();
    const day = program.days.find((d) => d.dayId === dayId);
    if (!day || day.restDay) {
      return NextResponse.json({ ok: false, error: "invalid-day" }, { status: 400 });
    }
    const prev = completions[date] || { dayId, exercisesDone: [] as string[], dayComplete: false };
    const done = new Set(prev.dayId === dayId ? prev.exercisesDone : []);
    const exerciseKey = String(body.exerciseKey || "").trim();
    if (exerciseKey && day.exercises.some((x) => x.exerciseKey === exerciseKey)) {
      done.add(exerciseKey);
    }
    const allKeys = day.exercises.map((x) => x.exerciseKey);
    const dayComplete =
      body.dayComplete === true || (allKeys.length > 0 && allKeys.every((k) => done.has(k)));
    completions[date] = { dayId, exercisesDone: [...done], dayComplete };
  }

  const startedAt = existing?.started_at || new Date().toISOString();
  const row = {
    gym_id: ctx.gymId,
    member_uuid: session.member.member_uuid,
    level,
    program_version: programBase.version,
    started_at: startedAt,
    current_week: Number(existing?.current_week) || 1,
    completions,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await svc.client
    .from(PROGRESS_TABLE)
    .upsert(row, { onConflict: "gym_id,member_uuid" })
    .select("level, program_version, started_at, current_week, completions")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "save-failed", message: error.message },
      { status: 500 },
    );
  }

  const mediaByKey = await loadWorkoutExerciseMediaMap(svc.client, ctx.gymId);

  return NextResponse.json(
    {
      ok: true,
      eligible: true,
      member: { name: ctx.member.fullName, trainerLabel: "Self" },
      levels: WORKOUT_LEVELS,
      activeLevel: level,
      videos: mediaByKey,
      program: {
        ...attachWorkoutVideos(program, mediaByKey),
        progression: SHARED_PROGRESSION,
        trainerNote: TRAINER_NOTE,
      },
      progress: {
        startedAt: data?.started_at || startedAt,
        currentWeek: Number(data?.current_week) || 1,
        completions: data?.completions || completions,
      },
      today: todayIst(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
