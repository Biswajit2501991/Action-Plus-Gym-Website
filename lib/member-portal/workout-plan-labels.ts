import type { WorkoutProgram } from "@/lib/member-portal/workout-programs";

const LABELS_TABLE = "portal_workout_exercise_labels";

function isMissingTableError(error: { message?: string; details?: string } | null) {
  const msg = `${error?.message || ""} ${error?.details || ""}`;
  return (
    /portal_workout_exercise_labels/i.test(msg) &&
    /schema cache|does not exist|relation/i.test(msg)
  );
}

/** Load gym-wide display-name overrides keyed by exercise_key. */
export async function loadWorkoutExerciseLabels(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (t: string) => any } | null | undefined,
  gymId: string,
): Promise<Record<string, string>> {
  if (!client || !gymId) return {};
  const { data, error } = await client
    .from(LABELS_TABLE)
    .select("exercise_key, display_name")
    .eq("gym_id", gymId);
  if (error) {
    if (isMissingTableError(error)) return {};
    return {};
  }
  const out: Record<string, string> = {};
  for (const row of data || []) {
    const key = String(row.exercise_key || "").trim();
    const name = String(row.display_name || "").trim();
    if (key && name) out[key] = name;
  }
  return out;
}

/** Apply display-name overrides without changing exercise_key. */
export function applyWorkoutExerciseLabels(
  program: WorkoutProgram,
  labels: Record<string, string>,
): WorkoutProgram {
  if (!labels || !Object.keys(labels).length) return program;
  return {
    ...program,
    days: program.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => ({
        ...ex,
        name: labels[ex.exerciseKey] || ex.name,
      })),
    })),
  };
}
