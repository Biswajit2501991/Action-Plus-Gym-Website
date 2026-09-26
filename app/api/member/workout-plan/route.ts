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
  applyWorkoutExerciseLabels,
  loadWorkoutExerciseLabels,
} from "@/lib/member-portal/workout-plan-labels";
import {
  getWorkoutProgram,
  SHARED_PROGRESSION,
  TRAINER_NOTE,
  WORKOUT_LEVELS,
  type WorkoutLevel,
  type WorkoutProgram,
} from "@/lib/member-portal/workout-programs";
import {
  parseWorkoutGoals,
  personalizeWorkoutProgram,
  pickLeastUsedWorkoutVariant,
  WORKOUT_GOAL_OPTIONS,
  workoutGoalNote,
  workoutVariantIndex,
  type WorkoutGoalId,
} from "@/lib/member-portal/workout-goals";

const PROGRESS_TABLE = "member_workout_program_progress";
const GOAL_TABLE = "member_workout_goal_plan";

type GoalRow = {
  level?: string | null;
  goals?: unknown;
  variant_id?: string | null;
  skipped?: boolean | null;
};

type GoalMeta = {
  goals: WorkoutGoalId[];
  goalStatus: "unset" | "skipped" | "set";
  goalNote: string | null;
  goalOptions: typeof WORKOUT_GOAL_OPTIONS;
};

function goalMeta(level: WorkoutLevel | null, row: GoalRow | null): GoalMeta & { programGoals: WorkoutGoalId[]; variantIndex: number } {
  const same = Boolean(level && row && String(row.level || "") === level);
  const goals = same ? parseWorkoutGoals(row?.goals) : [];
  const skipped = Boolean(same && row?.skipped);
  const goalStatus: GoalMeta["goalStatus"] = !same || !row ? "unset" : skipped || goals.length === 0 ? "skipped" : "set";
  return {
    goals: goalStatus === "set" ? goals : [],
    goalStatus,
    goalNote: goalStatus === "set" ? workoutGoalNote(goals) : null,
    goalOptions: WORKOUT_GOAL_OPTIONS,
    programGoals: goalStatus === "set" ? goals : [],
    variantIndex: goalStatus === "set" ? workoutVariantIndex(row?.variant_id) : 0,
  };
}

function applyGoalVariant(program: WorkoutProgram, meta: ReturnType<typeof goalMeta>) {
  if (!meta.programGoals.length) return program;
  return personalizeWorkoutProgram(program, meta.programGoals, meta.variantIndex);
}

function goalStorageMissing(message: string) {
  return /does not exist|schema cache|member_workout_goal_plan/i.test(message);
}

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

async function loadGoal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (t: string) => any },
  gymId: string,
  memberUuid: string,
): Promise<GoalRow | null> {
  const { data, error } = await client
    .from(GOAL_TABLE)
    .select("level, goals, variant_id, skipped")
    .eq("gym_id", gymId)
    .eq("member_uuid", memberUuid)
    .maybeSingle();
  if (error) return null;
  return data as GoalRow;
}

async function countVariants(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (t: string) => any },
  gymId: string,
  level: WorkoutLevel,
) {
  const counts: Record<string, number> = {};
  const { data, error } = await client
    .from(GOAL_TABLE)
    .select("variant_id")
    .eq("gym_id", gymId)
    .eq("level", level)
    .eq("skipped", false);
  if (error || !Array.isArray(data)) return counts;
  for (const row of data as Array<{ variant_id?: string | null }>) {
    const id = String(row.variant_id || "");
    if (!id) continue;
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
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
  const goal = svc.ok ? await loadGoal(svc.client, ctx.gymId, session.member.member_uuid) : null;
  const meta = goalMeta(level, goal);
  const baseProgram = level ? getWorkoutProgram(level) : null;
  const rawProgram = baseProgram ? applyGoalVariant(baseProgram, meta) : null;
  const extras =
    rawProgram && svc.ok
      ? await loadWorkoutDayExtras(svc.client, ctx.gymId, level as string)
      : [];
  const labels = svc.ok ? await loadWorkoutExerciseLabels(svc.client, ctx.gymId) : {};
  const mergedProgram = rawProgram
    ? applyWorkoutExerciseLabels(mergeProgramDayExtras(rawProgram, extras), labels)
    : null;
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
        ? {
            ...program,
            progression: SHARED_PROGRESSION,
            trainerNote: meta.goalNote ? `${TRAINER_NOTE}\n\n${meta.goalNote}` : TRAINER_NOTE,
          }
        : null,
      goals: meta.goals,
      goalStatus: meta.goalStatus,
      goalNote: meta.goalNote,
      goalOptions: meta.goalOptions,
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

function sameGoalList(a: WorkoutGoalId[], b: WorkoutGoalId[]) {
  return [...a].sort().join("|") === [...b].sort().join("|");
}

async function saveGoalChoice(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (t: string) => any },
  input: {
    gymId: string;
    memberUuid: string;
    level: WorkoutLevel;
    existing: GoalRow | null;
    goals: unknown;
    skip: boolean;
    confirm: boolean;
  },
): Promise<
  | { needsConfirm: true }
  | { error: string; message?: string; status: number }
  | { row: GoalRow }
> {
  const requested = Array.isArray(input.goals) ? input.goals : [];
  const nextGoals = input.skip ? [] : parseWorkoutGoals(requested);
  if (!input.skip && requested.length > 0 && nextGoals.length === 0) {
    return { error: "invalid-goals", status: 400 };
  }
  const skip = input.skip || nextGoals.length === 0;
  const sameLevel = Boolean(input.existing && String(input.existing.level || "") === input.level);
  const prevGoals = sameLevel ? parseWorkoutGoals(input.existing?.goals) : [];
  const prevSet = Boolean(sameLevel && input.existing && !input.existing.skipped && prevGoals.length > 0);
  const changed = prevSet && (skip || !sameGoalList(prevGoals, nextGoals));
  if (changed && !input.confirm) return { needsConfirm: true };

  let variantId: string | null = null;
  if (!skip) {
    const keep =
      sameLevel &&
      input.existing &&
      !input.existing.skipped &&
      sameGoalList(prevGoals, nextGoals) &&
      input.existing.variant_id;
    variantId = keep
      ? String(input.existing?.variant_id)
      : pickLeastUsedWorkoutVariant(
          input.level,
          nextGoals,
          await countVariants(client, input.gymId, input.level),
        );
  }

  const row = {
    gym_id: input.gymId,
    member_uuid: input.memberUuid,
    level: input.level,
    goals: nextGoals,
    variant_id: variantId,
    skipped: skip,
    updated_at: new Date().toISOString(),
  };
  const { error } = await client.from(GOAL_TABLE).upsert(row, { onConflict: "gym_id,member_uuid" });
  if (error) {
    const message = String(error.message || "");
    if (goalStorageMissing(message)) {
      return { error: "goal-storage-not-ready", message, status: 503 };
    }
    return { error: "save-failed", message, status: 500 };
  }
  return {
    row: { level: input.level, goals: nextGoals, variant_id: variantId, skipped: skip },
  };
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
    goals?: unknown;
    skip?: boolean;
    confirm?: boolean;
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

  let goal = await loadGoal(svc.client, ctx.gymId, session.member.member_uuid);
  if (action === "goals") {
    const saved = await saveGoalChoice(svc.client, {
      gymId: ctx.gymId,
      memberUuid: session.member.member_uuid,
      level,
      existing: goal,
      goals: body.goals,
      skip: body.skip === true,
      confirm: body.confirm === true,
    });
    if ("needsConfirm" in saved) {
      return NextResponse.json(
        { ok: true, needsConfirm: true, activeLevel: level },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if ("error" in saved) {
      return NextResponse.json(
        { ok: false, error: saved.error, message: saved.message },
        { status: saved.status },
      );
    }
    goal = saved.row;
  }

  const meta = goalMeta(level, goal);
  const programBase = getWorkoutProgram(level);
  if (!programBase) {
    return NextResponse.json({ ok: false, error: "unknown-program" }, { status: 400 });
  }
  const shaped = applyGoalVariant(programBase, meta);
  const extras = await loadWorkoutDayExtras(svc.client, ctx.gymId, level);
  const programMerged = mergeProgramDayExtras(shaped, extras);
  const labels = await loadWorkoutExerciseLabels(svc.client, ctx.gymId);
  const program = applyWorkoutExerciseLabels(programMerged, labels);

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

  const progressPayload = {
    startedAt: data?.started_at || startedAt,
    currentWeek: Number(data?.current_week) || 1,
    completions: (data?.completions || completions) as Completions,
  };

  // Progress ticks: slim response (no media reload) for fast Done.
  if (action === "progress") {
    return NextResponse.json(
      {
        ok: true,
        action: "progress",
        eligible: true,
        activeLevel: level,
        progress: progressPayload,
        today: todayIst(),
      },
      { headers: { "Cache-Control": "no-store" } },
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
        trainerNote: meta.goalNote ? `${TRAINER_NOTE}\n\n${meta.goalNote}` : TRAINER_NOTE,
      },
      goals: meta.goals,
      goalStatus: meta.goalStatus,
      goalNote: meta.goalNote,
      goalOptions: meta.goalOptions,
      progress: progressPayload,
      today: todayIst(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
