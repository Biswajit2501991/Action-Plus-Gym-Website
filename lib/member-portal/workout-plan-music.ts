import { portalGymId } from "@/lib/member-portal/config";

const TABLE = "portal_workout_music";

export type WorkoutPlanMusicMeta = {
  title: string;
  mp4Url: string;
};

/** Light gym-wide music meta for icon + player (file streams only on Play). */
export async function loadActiveWorkoutPlanMusic(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (t: string) => any } | null | undefined,
  gymId = portalGymId(),
): Promise<WorkoutPlanMusicMeta | null> {
  if (!client || !gymId) return null;
  try {
    const { data, error } = await client
      .from(TABLE)
      .select("title, mp4_url, is_active")
      .eq("gym_id", gymId)
      .maybeSingle();
    if (error || !data) return null;
    const mp4Url = String(data.mp4_url || "").trim();
    if (data.is_active === false || !mp4Url) return null;
    return {
      title: String(data.title || "Gym music").trim() || "Gym music",
      mp4Url,
    };
  } catch {
    return null;
  }
}
