import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";
import { findMemberByMobile } from "@/lib/member-portal/members";
import { normalizeMobile } from "@/lib/member-portal/phone";

/** Poll staff approval status for a WhatsApp verification challenge. */
export async function GET(req: NextRequest) {
  const challengeId = String(req.nextUrl.searchParams.get("challengeId") || "").trim();
  const mobileRaw = String(req.nextUrl.searchParams.get("mobile") || "").trim();
  if (!challengeId) {
    return NextResponse.json({ ok: false, error: "Missing challengeId" }, { status: 400 });
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const { data: challenge } = await svc.client
    .from("member_portal_otp_challenges")
    .select(
      "id, member_uuid, mobile_normalized, expires_at, staff_status, verification_channel, consumed_at",
    )
    .eq("id", challengeId)
    .eq("gym_id", portalGymId())
    .maybeSingle();

  if (!challenge) {
    return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 });
  }

  if (mobileRaw) {
    const mobile = normalizeMobile(mobileRaw);
    if (mobile !== challenge.mobile_normalized) {
      return NextResponse.json({ ok: false, error: "Mismatch" }, { status: 403 });
    }
  }

  const expired = new Date(challenge.expires_at).getTime() < Date.now();
  let status = challenge.staff_status || "none";
  if (expired && status === "pending") status = "expired";

  let hasPin = false;
  const found = await findMemberByMobile(challenge.mobile_normalized);
  if (found.ok) hasPin = Boolean(found.member.pin_hash);

  return NextResponse.json({
    ok: true,
    status,
    expired,
    hasPin,
    mode: challenge.verification_channel || "whatsapp_staff",
  });
}
