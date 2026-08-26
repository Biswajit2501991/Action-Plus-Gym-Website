import { createClient } from "@supabase/supabase-js";
import { GYM_ID } from "@/lib/config";
import type { WorkoutProgram } from "@/lib/member-portal/workout-programs";

const MEDIA_TABLE = "portal_workout_exercise_media";

export type WorkoutExerciseMedia = {
  exerciseKey: string;
  mp4Url: string | null;
};

function gymIdsToTry(gymId?: string) {
  const ids = [gymId, GYM_ID, process.env.NEXT_PUBLIC_GYM_ID]
    .map((v) => String(v || "").trim())
    .filter((v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));
  return [...new Set(ids)];
}

function normalizeKey(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function indexRows(
  rows: Array<{
    exercise_key?: string;
    display_name?: string | null;
    mp4_url?: string | null;
  }>,
) {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const url = String(row.mp4_url || "").trim();
    if (!url) continue;
    const keys = [row.exercise_key, row.display_name, normalizeKey(String(row.exercise_key || ""))];
    for (const key of keys) {
      const k = String(key || "").trim();
      if (k) out[k] = url;
    }
  }
  return out;
}

async function readMediaRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (t: string) => any } | null | undefined,
  gymIds: string[],
) {
  if (!client || !gymIds.length) return {} as Record<string, string>;
  const { data, error } = await client
    .from(MEDIA_TABLE)
    .select("exercise_key, display_name, mp4_url, is_active")
    .in("gym_id", gymIds);
  if (error || !Array.isArray(data)) return {};
  const active = (data as Array<{ is_active?: boolean | null; mp4_url?: string | null }>).filter(
    (row) => row.is_active !== false && String(row.mp4_url || "").trim(),
  );
  return indexRows(active);
}

function anonClient() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function loadWorkoutExerciseMediaMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (t: string) => any } | null | undefined,
  gymId = GYM_ID,
): Promise<Record<string, string>> {
  const gymIds = gymIdsToTry(gymId);
  const fromService = await readMediaRows(client, gymIds);
  if (Object.keys(fromService).length) return fromService;
  return readMediaRows(anonClient(), gymIds);
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
        mp4Url:
          mediaByKey[ex.exerciseKey] ||
          mediaByKey[normalizeKey(ex.exerciseKey)] ||
          mediaByKey[ex.name] ||
          mediaByKey[normalizeKey(ex.name)] ||
          null,
      })),
    })),
  };
}
