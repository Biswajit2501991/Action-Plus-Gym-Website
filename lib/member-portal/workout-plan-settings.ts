import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";
import { fetchExerciseTypeLookupValues } from "@/lib/member-portal/portal-home-tile-markers";
import {
  DEFAULT_PORTAL_SECTIONS,
  portalSectionsFromSettings,
  type PortalSections,
} from "@/lib/member-portal/portal-ui-config";
import {
  evaluateWorkoutPlanVisibility,
  normalizeWorkoutPlanByStatus,
  normalizeWorkoutPlanTesterNames,
  type WorkoutPlanByStatus,
} from "@/lib/member-portal/workout-plan-access";

export type WorkoutPlanSettings = {
  portalSections: PortalSections;
  byStatus: WorkoutPlanByStatus;
  testerNames: string[];
};

export async function loadWorkoutPlanSettings(): Promise<WorkoutPlanSettings> {
  const fallback: WorkoutPlanSettings = {
    portalSections: { ...DEFAULT_PORTAL_SECTIONS },
    byStatus: normalizeWorkoutPlanByStatus(null),
    testerNames: normalizeWorkoutPlanTesterNames(null),
  };
  const svc = createServiceRoleClient();
  if (!svc.ok) return fallback;
  const gymId = portalGymId();
  if (!gymId) return fallback;

  const exerciseTypes = await fetchExerciseTypeLookupValues(svc.client).catch(() => []);
  const full = await svc.client
    .from("member_portal_settings")
    .select(
      "portal_sections, basic_workout_options, workout_plan_by_status, workout_plan_tester_names",
    )
    .eq("gym_id", gymId)
    .maybeSingle();

  let row = full.data as Record<string, unknown> | null;
  if (full.error) {
    const basic = await svc.client
      .from("member_portal_settings")
      .select("portal_sections, basic_workout_options")
      .eq("gym_id", gymId)
      .maybeSingle();
    row = (basic.data as Record<string, unknown> | null) || null;
  }

  return {
    portalSections: portalSectionsFromSettings({
      portal_sections: row?.portal_sections,
      basic_workout_options: row?.basic_workout_options,
      exerciseTypes,
    }),
    byStatus: normalizeWorkoutPlanByStatus(row?.workout_plan_by_status),
    testerNames: normalizeWorkoutPlanTesterNames(row?.workout_plan_tester_names),
  };
}

export async function loadMemberWorkoutPlanContext(memberUuid: string) {
  const svc = createServiceRoleClient();
  if (!svc.ok) return { ok: false as const, error: svc.error };
  const gymId = portalGymId();
  const { data, error } = await svc.client
    .from("members")
    .select(
      "full_name, member_code, status, plan_name, portal_workout_plan_enabled, portal_workout_plan_hidden, portal_workout_plan_enabled_from, portal_workout_plan_enabled_until",
    )
    .eq("gym_id", gymId)
    .eq("member_uuid", memberUuid)
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: error.message };
  }

  const member = data as {
    full_name?: string | null;
    member_code?: string | null;
    status?: string | null;
    plan_name?: string | null;
    portal_workout_plan_enabled?: boolean | null;
    portal_workout_plan_hidden?: boolean | null;
    portal_workout_plan_enabled_from?: string | null;
    portal_workout_plan_enabled_until?: string | null;
  } | null;

  if (!member) return { ok: false as const, error: "member-not-found" };

  const settings = await loadWorkoutPlanSettings();
  const gate = evaluateWorkoutPlanVisibility({
    autoRolloutOn: settings.portalSections.homeWorkoutPlan !== false,
    byStatus: settings.byStatus,
    memberSwitchOn: member.portal_workout_plan_enabled === true,
    memberHidden: member.portal_workout_plan_hidden === true,
    status: member.status,
    planName: member.plan_name,
    enabledFrom: member.portal_workout_plan_enabled_from,
    enabledUntil: member.portal_workout_plan_enabled_until,
  });

  return {
    ok: true as const,
    gymId,
    member: {
      fullName: String(member.full_name || "").trim() || "Member",
      memberCode: String(member.member_code || "").trim(),
      status: member.status,
      planName: member.plan_name,
    },
    settings,
    gate,
  };
}
