import { GYM_ID } from "@/lib/config";
import type { WorkoutProgram } from "@/lib/member-portal/workout-programs";

const MEDIA_TABLE = "portal_workout_exercise_media";

export type WorkoutExerciseMedia = {
  exerciseKey: string;
  mp4Url: string | null;
};

export async function loadWorkoutExerciseMediaMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (t: string) => any },
  gymId = GYM_ID,
): Promise<Record<string, string>> {
  const { data, error } = await client
    .from(MEDIA_TABLE)
    .select("exercise_key, mp4_url")
    .eq("gym_id", gymId)
    .eq("is_active", true);
  if (error || !Array.isArray(data)) return {};
  const out: Record<string, string> = {};
  for (const row of data as Array<{ exercise_key?: string; mp4_url?: string | null }>) {
    const key = String(row.exercise_key || "").trim();
    const url = String(row.mp4_url || "").trim();
    if (key && url) out[key] = url;
  }
  return out;
}

export function attachWorkoutVideos(
  program: WorkoutProgram,
  mediaByKey: Record<string, string>,
): WorkoutProgram {
  return {
    ...program,
    days: program.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => ({
        ...ex,
        mp4Url: mediaByKey[ex.exerciseKey] || null,
      })),
    })),
  };
}
