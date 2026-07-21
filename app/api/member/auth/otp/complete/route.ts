import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";
import { normalizeMobile } from "@/lib/member-portal/phone";
import { findMemberByMobile, assertPortalEligible } from "@/lib/member-portal/members";
import {
  auditLog,
  issueSession,
  requestMeta,
} from "@/lib/member-portal/session";

const bodySchema = z.object({
  mobile: z.string().min(8).max(20),
  challengeId: z.string().uuid(),
  deviceId: z.string().min(8).max(128),
  deviceLabel: z.string().max(64).optional(),
});

/**
 * After staff approves WhatsApp verification:
 * - if PIN exists → issue session
 * - if no PIN → return needsPin for set-PIN step
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const mobile = normalizeMobile(parsed.data.mobile);
    const found = await findMemberByMobile(mobile);
    if (!found.ok) {
      return NextResponse.json({ ok: false, error: found.error }, { status: found.status });
    }
    const eligible = assertPortalEligible(found.member);
    if (!eligible.ok) {
      return NextResponse.json(
        { ok: false, error: eligible.error },
        { status: eligible.status },
      );
    }

    const svc = createServiceRoleClient();
    if (!svc.ok) {
      return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
    }

    const { data: challenge } = await svc.client
      .from("member_portal_otp_challenges")
      .select("*")
      .eq("id", parsed.data.challengeId)
      .eq("gym_id", portalGymId())
      .eq("member_uuid", found.member.member_uuid)
      .maybeSingle();

    if (!challenge) {
      return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 });
    }
    if (challenge.staff_status !== "approved") {
      return NextResponse.json(
        { ok: false, error: "Waiting for gym staff approval" },
        { status: 403 },
      );
    }
    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: "Verification expired" }, { status: 400 });
    }

    const { ip, userAgent } = requestMeta(req);

    if (!found.member.pin_hash) {
      // Mark consumed so pin/set can proceed
      if (!challenge.consumed_at) {
        await svc.client
          .from("member_portal_otp_challenges")
          .update({ consumed_at: new Date().toISOString() })
          .eq("id", challenge.id);
      }
      return NextResponse.json({
        ok: true,
        needsPin: true,
        challengeId: challenge.id,
        deviceId: parsed.data.deviceId,
      });
    }

    if (!challenge.consumed_at) {
      await svc.client
        .from("member_portal_otp_challenges")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", challenge.id);
    }

    const session = await issueSession({
      member: found.member,
      deviceId: parsed.data.deviceId,
      deviceLabel: parsed.data.deviceLabel,
      ip,
      userAgent,
    });

    if (!session.ok) {
      return NextResponse.json(
        { ok: false, error: session.error },
        { status: session.status },
      );
    }

    await auditLog({
      memberUuid: found.member.member_uuid,
      eventType: "whatsapp_verify_completed",
      ip,
      userAgent,
    });

    return NextResponse.json({ ok: true, needsPin: false });
  } catch (error) {
    console.error("otp/complete", error);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
