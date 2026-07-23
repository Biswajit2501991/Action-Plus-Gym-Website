import type { SupabaseClient } from "@supabase/supabase-js";
import { portalGymId } from "@/lib/member-portal/config";

/** Values used as durable home-tile visibility markers (Gym Manager settings lookups). */
export async function fetchExerciseTypeLookupValues(
  client: SupabaseClient,
): Promise<string[]> {
  const gymId = portalGymId();
  if (!gymId) return [];
  const { data, error } = await client
    .from("settings_lookup_values")
    .select("value")
    .eq("gym_id", gymId)
    .eq("category", "exerciseTypes")
    .eq("is_active", true);
  if (error || !Array.isArray(data)) return [];
  return data
    .map((row) => String((row as { value?: string }).value || "").trim())
    .filter(Boolean);
}
