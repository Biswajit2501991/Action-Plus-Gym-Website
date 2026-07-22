import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  MEMBER_DEVICE_COOKIE,
  MEMBER_OTP_COOLDOWN_SEC,
  MEMBER_OTP_HOURLY_LIMIT,
  MEMBER_OTP_TTL_SEC,
  portalGymId,
} from "@/lib/member-portal/config";
import { hashOtp, randomOtp6, randomToken } from "@/lib/member-portal/crypto";
import { isValidIndianMobile, normalizeMobile } from "@/lib/member-portal/phone";
import {
  assertPortalEligible,
  findMembersByMobile,
} from "@/lib/member-portal/members";
import {
  isValidDobInput,
  memberMatchesIdentity,
  normalizeEmailForCompare,
} from "@/lib/member-portal/identity";
import { getPortalAuthMethod } from "@/lib/member-portal/portal-auth-settings";
import { auditLog, requestMeta } from "@/lib/member-portal/session";

const bodySchema = z
  .object({
    mobile: z.string().min(8).max(20),
    fullName: z.string().min(2).max(120),
    dob: z.string().max(32).optional(),
    email: z.string().max(160).optional(),
    deviceId: z.string().min(8).max(128).optional(),
    honeypot: z.string().optional(),
  })
  .refine(
    (v) => {
      const hasDob = Boolean(String(v.dob || "").trim());
      const hasEmail = Boolean(String(v.email || "").trim());
      return hasDob !== hasEmail;
    },
    { message: "Provide either DOB or Gmail (not both)" },
  );

/**
 * Auto-identity onboarding when owner selects auth_method = auto_identity.
 * Matches mobile + name + (DOB XOR email) against DB (comparison-only normalize).
 * Does not mutate member name/dob/email. Creates an approved challenge for PIN set.
 */
export async function POST(req: NextRequest) {
  try {
    const authMethod = await getPortalAuthMethod();
    if (authMethod !== "auto_identity") {
      return NextResponse.json(
        {
          ok: false,
          error: "Auto identity auth is not enabled. Use WhatsApp verification.",
        },
        { status: 403 },
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            parsed.error.issues[0]?.message ||
            "Enter mobile, name, and either DOB or Gmail",
        },
        { status: 400 },
      );
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

    const dobRaw = String(parsed.data.dob || "").trim();
    const emailRaw = String(parsed.data.email || "").trim();
    if (dobRaw && !isValidDobInput(dobRaw)) {
      return NextResponse.json(
        { ok: false, error: "Enter DOB as DD/MM/YYYY" },
        { status: 400 },
      );
    }
    if (emailRaw && !normalizeEmailForCompare(emailRaw).includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid Gmail / email" },
        { status: 400 },
      );
    }

    const listed = await findMembersByMobile(mobile);
    if (!listed.ok) {
      return NextResponse.json(
        { ok: false, error: listed.error },
        { status: listed.status },
      );
    }
    if (!listed.members.length) {
      return NextResponse.json(
        { ok: false, error: "No membership found for this number" },
        { status: 404 },
      );
    }

    const identity = {
      fullName: parsed.data.fullName,
      dob: dobRaw || undefined,
      email: emailRaw || undefined,
    };

    const matched = listed.members.filter((m) =>
      memberMatchesIdentity(m, identity),
    );
    if (!matched.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Details do not match gym records. Check name and DOB/Gmail as registered.",
        },
        { status: 403 },
      );
    }

    // Prefer eligible Active/Hold among identity matches
    const eligibleMatches = matched.filter((m) => assertPortalEligible(m).ok);
    const member =
      eligibleMatches.find(
        (m) => String(m.status || "").trim().toLowerCase() === "active",
      ) ||
      eligibleMatches[0] ||
      matched[0];

    if (!member?.member_uuid) {
      return NextResponse.json(
        { ok: false, error: "Member portal not ready. Contact the gym." },
        { status: 503 },
      );
    }

    const eligible = assertPortalEligible(member);
    if (!eligible.ok) {
      return NextResponse.json(
        { ok: false, error: eligible.error },
        { status: eligible.status },
      );
    }

    const status = String(member.status || "").trim().toLowerCase();
    if (status !== "active" && status !== "hold") {
      return NextResponse.json(
        {
          ok: false,
          error: "This membership status cannot use the portal. Contact the gym.",
        },
        { status: 403 },
      );
    }

    const svc = createServiceRoleClient();
    if (!svc.ok) {
      return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
    }

    if (!member.qr_token) {
      await svc.client
        .from("members")
        .update({ qr_token: randomToken(32) })
        .eq("id", member.id);
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

    await svc.client
      .from("member_portal_otp_challenges")
      .update({ staff_status: "rejected", staff_note: "superseded" })
      .eq("gym_id", portalGymId())
      .eq("member_uuid", member.member_uuid)
      .eq("staff_status", "pending");

    const otp = randomOtp6();
    const challengeId = randomUUID();
    const codeHash = hashOtp(otp, challengeId);
    const expiresAt = new Date(
      Date.now() + MEMBER_OTP_TTL_SEC * 1000,
    ).toISOString();
    const nowIso = new Date().toISOString();

    const jar = await cookies();
    const deviceId =
      parsed.data.deviceId ||
      jar.get(MEMBER_DEVICE_COOKIE)?.value ||
      randomToken(16);

    const { error: insErr } = await svc.client
      .from("member_portal_otp_challenges")
      .insert({
        id: challengeId,
        gym_id: portalGymId(),
        member_uuid: member.member_uuid,
        mobile_normalized: mobile,
        code_hash: codeHash,
        expires_at: expiresAt,
        ip,
        user_agent: userAgent,
        device_fingerprint: deviceId,
        verification_channel: "auto_identity",
        staff_status: "approved",
        staff_approved_at: nowIso,
        staff_note: dobRaw ? "auto:dob" : "auto:email",
        otp_plain_for_staff: null,
      });

    if (insErr) {
      console.error(insErr);
      return NextResponse.json(
        { ok: false, error: "Could not complete verification" },
        { status: 500 },
      );
    }

    await auditLog({
      memberUuid: member.member_uuid,
      eventType: "auto_identity_verified",
      meta: {
        challengeId,
        factor: dobRaw ? "dob" : "email",
      },
      ip,
      userAgent,
    });

    const hasPin = Boolean(member.pin_hash) && member.portal_status !== "revoked";

    return NextResponse.json({
      ok: true,
      mode: "auto_identity",
      challengeId,
      deviceId,
      hasPin,
      needsPin: !hasPin,
      maskedMobile: `******${mobile.slice(-4)}`,
      memberName: String(member.full_name || "Member").split(" ")[0] || "Member",
    });
  } catch (error) {
    console.error("auth/auto/verify", error);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
