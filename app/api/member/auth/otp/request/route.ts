import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  MEMBER_OTP_COOLDOWN_SEC,
  MEMBER_OTP_HOURLY_LIMIT,
  MEMBER_OTP_TTL_SEC,
  MEMBER_DEVICE_COOKIE,
  portalGymId,
} from "@/lib/member-portal/config";
import { randomUUID } from "crypto";
import { hashOtp, randomOtp6, randomToken } from "@/lib/member-portal/crypto";
import { isValidIndianMobile, normalizeMobile } from "@/lib/member-portal/phone";
import { sendMemberOtpSms } from "@/lib/member-portal/sms";
import {
  assertPortalEligible,
  findMemberByMobile,
} from "@/lib/member-portal/members";
import { auditLog, requestMeta } from "@/lib/member-portal/session";
import { cookies } from "next/headers";

const bodySchema = z.object({
  mobile: z.string().min(8).max(20),
  deviceId: z.string().min(8).max(128).optional(),
  honeypot: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid mobile number" }, { status: 400 });
    }
    if (parsed.data.honeypot) {
      return NextResponse.json({ ok: true });
    }

    const mobile = normalizeMobile(parsed.data.mobile);
    if (!isValidIndianMobile(mobile)) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid 10-digit Indian mobile number" },
        { status: 400 },
      );
    }

    const found = await findMemberByMobile(mobile);
    if (!found.ok) {
      return NextResponse.json(
        { ok: false, error: found.error },
        { status: found.status },
      );
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

    const { ip, userAgent } = requestMeta(req);
    const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await svc.client
      .from("member_portal_otp_challenges")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", portalGymId())
      .eq("mobile_normalized", mobile)
      .gte("created_at", sinceHour);

    if ((count || 0) >= MEMBER_OTP_HOURLY_LIMIT) {
      return NextResponse.json(
        { ok: false, error: "Too many OTP requests. Try again later." },
        { status: 429 },
      );
    }

    const { data: latest } = await svc.client
      .from("member_portal_otp_challenges")
      .select("created_at")
      .eq("gym_id", portalGymId())
      .eq("mobile_normalized", mobile)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest?.created_at) {
      const ageMs = Date.now() - new Date(latest.created_at).getTime();
      if (ageMs < MEMBER_OTP_COOLDOWN_SEC * 1000) {
        return NextResponse.json(
          {
            ok: false,
            error: `Please wait ${MEMBER_OTP_COOLDOWN_SEC}s before requesting another OTP.`,
          },
          { status: 429 },
        );
      }
    }

    const otp = randomOtp6();
    const challengeId = randomUUID();
    const codeHash = hashOtp(otp, challengeId);
    const expiresAt = new Date(Date.now() + MEMBER_OTP_TTL_SEC * 1000).toISOString();

    const jar = await cookies();
    const deviceId =
      parsed.data.deviceId || jar.get(MEMBER_DEVICE_COOKIE)?.value || randomToken(16);

    const { error: insErr } = await svc.client.from("member_portal_otp_challenges").insert({
      id: challengeId,
      gym_id: portalGymId(),
      member_uuid: found.member.member_uuid,
      mobile_normalized: mobile,
      code_hash: codeHash,
      expires_at: expiresAt,
      ip,
      user_agent: userAgent,
      device_fingerprint: deviceId,
    });

    if (insErr) {
      console.error(insErr);
      return NextResponse.json({ ok: false, error: "Could not create OTP" }, { status: 500 });
    }

    const sent = await sendMemberOtpSms(mobile, otp);
    if (!sent.ok) {
      await auditLog({
        memberUuid: found.member.member_uuid,
        eventType: "otp_send_failed",
        meta: { provider: sent.provider, error: sent.error },
        ip,
        userAgent,
      });
      return NextResponse.json({ ok: false, error: sent.error }, { status: 502 });
    }

    await auditLog({
      memberUuid: found.member.member_uuid,
      eventType: "otp_sent",
      meta: { provider: sent.provider },
      ip,
      userAgent,
    });

    const payload: Record<string, unknown> = {
      ok: true,
      challengeId,
      deviceId,
      expiresInSec: MEMBER_OTP_TTL_SEC,
      hasPin: Boolean(found.member.pin_hash),
      maskedMobile: `******${mobile.slice(-4)}`,
    };

    if (sent.provider === "dev") {
      payload.devOtp = otp;
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("otp/request", error);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
