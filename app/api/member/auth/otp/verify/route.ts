import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";
import { hashOtp, safeEqualHex } from "@/lib/member-portal/crypto";
import { normalizeMobile } from "@/lib/member-portal/phone";
import { findMemberByMobile, assertPortalEligible } from "@/lib/member-portal/members";
import {
  auditLog,
  issueSession,
  requestMeta,
} from "@/lib/member-portal/session";

const bodySchema = z.object({
  mobile: z.string().min(8).max(20),
  challengeId: z.string().uuid().or(z.string().min(16).max(128)),
  otp: z.string().regex(/^\d{6}$/),
  deviceId: z.string().min(8).max(128),
  deviceLabel: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid OTP payload" }, { status: 400 });
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

    const { ip, userAgent } = requestMeta(req);

    if (!challenge || challenge.consumed_at) {
      return NextResponse.json({ ok: false, error: "OTP expired or invalid" }, { status: 400 });
    }
    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: "OTP expired" }, { status: 400 });
    }
    if (challenge.attempts >= challenge.max_attempts) {
      return NextResponse.json(
        { ok: false, error: "Too many incorrect attempts. Request a new OTP." },
        { status: 429 },
      );
    }

    const expected = hashOtp(parsed.data.otp, challenge.id);
    const match = safeEqualHex(expected, challenge.code_hash);
    if (!match) {
      await svc.client
        .from("member_portal_otp_challenges")
        .update({ attempts: challenge.attempts + 1 })
        .eq("id", challenge.id);
      await auditLog({
        memberUuid: found.member.member_uuid,
        eventType: "otp_failed",
        ip,
        userAgent,
      });
      return NextResponse.json({ ok: false, error: "Incorrect OTP" }, { status: 401 });
    }

    await svc.client
      .from("member_portal_otp_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challenge.id);

    await auditLog({
      memberUuid: found.member.member_uuid,
      eventType: "otp_verified",
      ip,
      userAgent,
    });

    const needsPin = !found.member.pin_hash;
    if (needsPin) {
      // Temporary cookie-less handoff: return verified flag; PIN set will issue session
      return NextResponse.json({
        ok: true,
        needsPin: true,
        memberUuid: found.member.member_uuid,
        deviceId: parsed.data.deviceId,
        challengeId: challenge.id,
      });
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

    return NextResponse.json({
      ok: true,
      needsPin: false,
      hasPin: true,
    });
  } catch (error) {
    console.error("otp/verify", error);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
