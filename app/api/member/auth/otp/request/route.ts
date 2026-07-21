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
import {
  assertPortalEligible,
  findMemberByMobile,
} from "@/lib/member-portal/members";
import { auditLog, requestMeta } from "@/lib/member-portal/session";
import { buildGymVerifyWhatsAppUrl } from "@/lib/member-portal/whatsapp-verify";
import { cookies } from "next/headers";

const bodySchema = z.object({
  mobile: z.string().min(8).max(20),
  deviceId: z.string().min(8).max(128).optional(),
  honeypot: z.string().optional(),
});

/**
 * Staff-assisted WhatsApp verification (primary).
 * Creates a pending challenge and a wa.me link to the gym WhatsApp number.
 */
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
        { ok: false, error: "Too many verification requests. Try again later." },
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
            error: `Please wait ${MEMBER_OTP_COOLDOWN_SEC}s before requesting again.`,
          },
          { status: 429 },
        );
      }
    }

    // Expire any previous pending staff requests for this member
    await svc.client
      .from("member_portal_otp_challenges")
      .update({ staff_status: "rejected", staff_note: "superseded" })
      .eq("gym_id", portalGymId())
      .eq("member_uuid", found.member.member_uuid)
      .eq("staff_status", "pending");

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
      verification_channel: "whatsapp_staff",
      staff_status: "pending",
      otp_plain_for_staff: otp,
    });

    if (insErr) {
      console.error(insErr);
      return NextResponse.json(
        { ok: false, error: "Could not create verification request" },
        { status: 500 },
      );
    }

    const whatsappUrl = buildGymVerifyWhatsAppUrl({
      memberName: found.member.full_name,
      memberMobile: mobile,
      memberCode: found.member.member_code,
      otp,
    });

    await auditLog({
      memberUuid: found.member.member_uuid,
      eventType: "whatsapp_verify_requested",
      meta: { challengeId },
      ip,
      userAgent,
    });

    return NextResponse.json({
      ok: true,
      mode: "whatsapp_staff",
      challengeId,
      deviceId,
      expiresInSec: MEMBER_OTP_TTL_SEC,
      hasPin: Boolean(found.member.pin_hash),
      maskedMobile: `******${mobile.slice(-4)}`,
      memberName: found.member.full_name.split(" ")[0] || "Member",
      whatsappUrl,
      gymWhatsApp: "+917047157510",
    });
  } catch (error) {
    console.error("otp/request", error);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
