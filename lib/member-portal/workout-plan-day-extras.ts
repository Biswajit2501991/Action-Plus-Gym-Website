import type { WorkoutProgram, WorkoutExercise } from "@/lib/member-portal/workout-programs";

const DAY_EXERCISES_TABLE = "portal_workout_day_exercises";

export type WorkoutDayExtraExercise = {
  dayId: string;
  exerciseKey: string;
  name: string;
  muscle: string;
  setsReps: string;
  rest: string;
  displayOrder: number;
};

function isMissingTableError(error: { message?: string; details?: string } | null) {
  const msg = `${error?.message || ""} ${error?.details || ""}`;
  return (
    /portal_workout_day_exercises/i.test(msg) &&
    /schema cache|does not exist|relation/i.test(msg)
  );
}

/** Load staff-added exercises for one level. Empty if table missing. */
export async function loadWorkoutDayExtras(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (t: string) => any } | null | undefined,
  gymId: string,
  level: string,
): Promise<WorkoutDayExtraExercise[]> {
  if (!client || !gymId || !level) return [];
  const { data, error } = await client
    .from(DAY_EXERCISES_TABLE)
    .select("day_id, exercise_key, name, muscle, sets_reps, rest, display_order")
    .eq("gym_id", gymId)
    .eq("level", level)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) {
    if (isMissingTableError(error)) return [];
    return [];
  }
  return (data || []).map(
    (row: {
      day_id?: string;
      exercise_key?: string;
      name?: string;
      muscle?: string;
      sets_reps?: string;
      rest?: string;
      display_order?: number;
    }) => ({
      dayId: String(row.day_id || ""),
      exerciseKey: String(row.exercise_key || ""),
      name: String(row.name || ""),
      muscle: String(row.muscle || ""),
      setsReps: String(row.sets_reps || "3×10–12"),
      rest: String(row.rest || "60–90s"),
      displayOrder: Number(row.display_order) || 100,
    }),
  ).filter((row: WorkoutDayExtraExercise) => row.dayId && row.exerciseKey && row.name);
}

/** Append staff extras after base exercises. Never removes or edits base rows. */
export function mergeProgramDayExtras(
  program: WorkoutProgram,
  extras: WorkoutDayExtraExercise[],
): WorkoutProgram {
  if (!extras.length) return program;
  const byDay = new Map<string, WorkoutDayExtraExercise[]>();
  for (const ex of extras) {
    const list = byDay.get(ex.dayId) || [];
    list.push(ex);
    byDay.set(ex.dayId, list);
  }
  return {
    ...program,
    days: program.days.map((day) => {
      if (day.restDay) return day;
      const add = (byDay.get(day.dayId) || []).slice().sort((a, b) => a.displayOrder - b.displayOrder);
      if (!add.length) return day;
      const existing = new Set(day.exercises.map((e) => e.exerciseKey));
      const appended: WorkoutExercise[] = [];
      for (const ex of add) {
        if (existing.has(ex.exerciseKey)) continue;
        existing.add(ex.exerciseKey);
        appended.push({
          exerciseKey: ex.exerciseKey,
          name: ex.name,
          muscle: ex.muscle,
          setsReps: ex.setsReps,
          rest: ex.rest,
        });
      }
      if (!appended.length) return day;
      return { ...day, exercises: [...day.exercises, ...appended] };
    }),
  };
}
