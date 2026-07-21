import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";
import { hashPin, isValidPin } from "@/lib/member-portal/crypto";
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
  pin: z.string(),
  deviceId: z.string().min(8).max(128),
  deviceLabel: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success || !isValidPin(parsed.data.pin)) {
      return NextResponse.json(
        { ok: false, error: "PIN must be exactly 6 digits" },
        { status: 400 },
      );
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
      .select("id, consumed_at, expires_at, member_uuid")
      .eq("id", parsed.data.challengeId)
      .eq("gym_id", portalGymId())
      .eq("member_uuid", found.member.member_uuid)
      .maybeSingle();

    if (!challenge?.consumed_at) {
      return NextResponse.json(
        { ok: false, error: "Verify OTP before setting a PIN" },
        { status: 400 },
      );
    }
    // Allow PIN set within 15 minutes of OTP verify
    const consumedAt = new Date(challenge.consumed_at).getTime();
    if (Date.now() - consumedAt > 15 * 60 * 1000) {
      return NextResponse.json(
        { ok: false, error: "OTP session expired. Request a new OTP." },
        { status: 400 },
      );
    }

    if (found.member.pin_hash) {
      return NextResponse.json(
        { ok: false, error: "PIN already set. Use PIN login or OTP." },
        { status: 400 },
      );
    }

    const pinHash = await hashPin(parsed.data.pin);
    const { error: updErr } = await svc.client
      .from("members")
      .update({
        pin_hash: pinHash,
        portal_status: "active",
        portal_enabled: true,
        portal_activated_at: new Date().toISOString(),
      })
      .eq("member_uuid", found.member.member_uuid);

    if (updErr) {
      console.error(updErr);
      return NextResponse.json({ ok: false, error: "Could not save PIN" }, { status: 500 });
    }

    const { ip, userAgent } = requestMeta(req);
    await auditLog({
      memberUuid: found.member.member_uuid,
      eventType: "pin_set",
      ip,
      userAgent,
    });

    const member = { ...found.member, pin_hash: pinHash, portal_status: "active" };
    const session = await issueSession({
      member,
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("pin/set", error);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
