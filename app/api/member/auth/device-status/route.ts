import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  PORTAL_MEMBERSHIP_STATUS_ERROR,
  isPortalAllowedMembershipStatus,
  portalGymId,
} from "@/lib/member-portal/config";
import { normalizeMobile } from "@/lib/member-portal/phone";

const querySchema = z.object({
  deviceId: z.string().min(8).max(128),
});

/**
 * Returning-device lookup: if this device fingerprint is already trusted and
 * the member has a PIN, the portal can skip name/DOB registration UI.
 * Does not create or modify devices/sessions.
 */
export async function GET(req: NextRequest) {
  try {
    const parsed = querySchema.safeParse({
      deviceId: req.nextUrl.searchParams.get("deviceId") || "",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { ok: true, registered: false, hasPin: false },
        { status: 200 },
      );
    }

    const deviceId = String(parsed.data.deviceId).trim();
    const svc = createServiceRoleClient();
    if (!svc.ok) {
      return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
    }

    const gymId = portalGymId();
    const { data: device, error: deviceErr } = await svc.client
      .from("member_portal_devices")
      .select("id, member_uuid, revoked_at, trusted")
      .eq("gym_id", gymId)
      .eq("device_id", deviceId)
      .is("revoked_at", null)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (deviceErr) {
      console.error("device-status", deviceErr);
      return NextResponse.json(
        { ok: true, registered: false, hasPin: false },
        { status: 200 },
      );
    }

    if (!device?.member_uuid) {
      return NextResponse.json(
        { ok: true, registered: false, hasPin: false },
        { status: 200 },
      );
    }

    const { data: member, error: memberErr } = await svc.client
      .from("members")
      .select("member_uuid, mobile, pin_hash, portal_status, portal_enabled, status, deleted_at")
      .eq("gym_id", gymId)
      .eq("member_uuid", device.member_uuid)
      .is("deleted_at", null)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json(
        { ok: true, registered: true, hasPin: false },
        { status: 200 },
      );
    }

    const status = String(member.status || "").trim().toLowerCase();
    const portalStatus = String(member.portal_status || "").trim().toLowerCase();
    if (
      !isPortalAllowedMembershipStatus(status) ||
      portalStatus === "disabled" ||
      portalStatus === "revoked" ||
      member.portal_enabled === false
    ) {
      return NextResponse.json({
        ok: true,
        registered: true,
        hasPin: false,
        blocked: true,
        reason:
          portalStatus === "revoked"
            ? "Access was revoked. Verify again to continue."
            : portalStatus === "disabled" || member.portal_enabled === false
              ? "Portal access is disabled for this membership. Contact the gym."
              : PORTAL_MEMBERSHIP_STATUS_ERROR,
      });
    }

    const mobile = normalizeMobile(String(member.mobile || ""));
    const hasPin = Boolean(member.pin_hash);

    return NextResponse.json({
      ok: true,
      registered: true,
      hasPin,
      mobile: hasPin && mobile.length >= 10 ? mobile : null,
      maskedMobile: mobile.length >= 4 ? `******${mobile.slice(-4)}` : null,
    });
  } catch (error) {
    console.error("device-status", error);
    return NextResponse.json(
      { ok: true, registered: false, hasPin: false },
      { status: 200 },
    );
  }
}
