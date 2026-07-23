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

export async function GET() {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  const member = session.member;

  const [branch, photoUrl, portalSections] = await Promise.all([
    branchLabel(member.assigned_gym_code_id),
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
    (async () => {
      const svc = createServiceRoleClient();
      if (!svc.ok) return DEFAULT_PORTAL_SECTIONS;
      const gymId = portalGymId();
      if (!gymId) return DEFAULT_PORTAL_SECTIONS;
      const { data } = await svc.client
        .from("member_portal_settings")
        .select("portal_sections, basic_workout_options")
        .eq("gym_id", gymId)
        .maybeSingle();
      return portalSectionsFromSettings({
        portal_sections: data?.portal_sections,
        basic_workout_options: data?.basic_workout_options,
      });
    })(),
  ]);

  // Fire-and-forget — do not delay home paint.
  void auditLog({
    memberUuid: member.member_uuid,
    eventType: "profile_viewed",
  });

  return NextResponse.json({
    ok: true,
    member: safeMemberPayload(member, branch, photoUrl),
    portalSections,
  });
}
