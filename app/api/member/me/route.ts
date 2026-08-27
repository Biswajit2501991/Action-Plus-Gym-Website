import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  auditLog,
  requireMemberSession,
} from "@/lib/member-portal/session";
import {
  branchLabel,
  safeMemberPayload,
} from "@/lib/member-portal/members";
import { portalGymId } from "@/lib/member-portal/config";
import {
  DEFAULT_PORTAL_SECTIONS,
  portalSectionsFromSettings,
} from "@/lib/member-portal/portal-ui-config";
import { fetchExerciseTypeLookupValues } from "@/lib/member-portal/portal-home-tile-markers";

export async function GET() {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  const member = session.member;

  const withTimeout = async <T,>(promise: Promise<T>, fallback: T, ms = 6_000): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((resolve) => {
          timer = setTimeout(() => resolve(fallback), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const [branch, photoUrl, portalSections] = await Promise.all([
    withTimeout(branchLabel(member.assigned_gym_code_id), null),
    withTimeout(
      (async (): Promise<string | null> => {
        const url: string | null = member.photo_url || null;
        if (!member.photo_path) return url;
        const svc = createServiceRoleClient();
        if (!svc.ok) return url;
        const { data } = await svc.client.storage
          .from("apg-media")
          .createSignedUrl(member.photo_path, 60 * 30);
        return data?.signedUrl || url;
      })(),
      member.photo_url || null,
    ),
    withTimeout(
      (async () => {
        const empty = {
          sections: { ...DEFAULT_PORTAL_SECTIONS },
          music: null as { title: string; mp4Url: string } | null,
        };
        const svc = createServiceRoleClient();
        if (!svc.ok) return empty;
        const gymId = portalGymId();
        if (!gymId) return empty;
        const [{ data }, exerciseTypes] = await Promise.all([
          svc.client
            .from("member_portal_settings")
            .select(
              "portal_sections, basic_workout_options, workout_plan_by_status, workout_plan_tester_names",
            )
            .eq("gym_id", gymId)
            .maybeSingle(),
          fetchExerciseTypeLookupValues(svc.client),
        ]);
        let row = data as Record<string, unknown> | null;
        if (!row && data === null) {
          const fallback = await svc.client
            .from("member_portal_settings")
            .select("portal_sections, basic_workout_options")
            .eq("gym_id", gymId)
            .maybeSingle();
          row = (fallback.data as Record<string, unknown> | null) || null;
        }
        const sections = portalSectionsFromSettings({
          portal_sections: row?.portal_sections,
          basic_workout_options: row?.basic_workout_options,
          exerciseTypes,
        });
        const { loadMemberWorkoutPlanContext } = await import(
          "@/lib/member-portal/workout-plan-settings"
        );
        const { loadActiveWorkoutPlanMusic } = await import(
          "@/lib/member-portal/workout-plan-music"
        );
        const ctx = await loadMemberWorkoutPlanContext(member.member_uuid);
        const visible = ctx.ok && ctx.gate.visible;
        const music = visible
          ? await loadActiveWorkoutPlanMusic(svc.client, gymId)
          : null;
        return {
          sections: { ...sections, homeWorkoutPlan: visible },
          music,
        };
      })(),
      {
        sections: { ...DEFAULT_PORTAL_SECTIONS, homeWorkoutPlan: false },
        music: null as { title: string; mp4Url: string } | null,
      },
    ),
  ]);

  // Fire-and-forget — do not delay home paint.
  void auditLog({
    memberUuid: member.member_uuid,
    eventType: "profile_viewed",
  });

  return NextResponse.json({
    ok: true,
    member: safeMemberPayload(member, branch, photoUrl),
    portalSections: portalSections.sections,
    workoutPlanMusic: portalSections.music,
  });
}
