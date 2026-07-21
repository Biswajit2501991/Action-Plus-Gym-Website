import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidPin, verifyPin } from "@/lib/member-portal/crypto";
import { normalizeMobile, isValidIndianMobile } from "@/lib/member-portal/phone";
import { findMemberByMobile, assertPortalEligible } from "@/lib/member-portal/members";
import {
  auditLog,
  issueSession,
  requestMeta,
} from "@/lib/member-portal/session";
import { cookies } from "next/headers";
import { MEMBER_DEVICE_COOKIE } from "@/lib/member-portal/config";
import { randomToken } from "@/lib/member-portal/crypto";

const bodySchema = z.object({
  mobile: z.string().min(8).max(20),
  pin: z.string(),
  deviceId: z.string().min(8).max(128).optional(),
  deviceLabel: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success || !isValidPin(parsed.data.pin)) {
      return NextResponse.json({ ok: false, error: "Invalid PIN" }, { status: 400 });
    }

    const mobile = normalizeMobile(parsed.data.mobile);
    if (!isValidIndianMobile(mobile)) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid mobile number" },
        { status: 400 },
      );
    }

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

    if (!found.member.pin_hash) {
      return NextResponse.json(
        {
          ok: false,
          error: "PIN not set or access was revoked. Use Verify via WhatsApp.",
        },
        { status: 400 },
      );
    }
    if (found.member.portal_status === "revoked") {
      return NextResponse.json(
        {
          ok: false,
          error: "Access revoked. Please verify via WhatsApp again.",
        },
        { status: 403 },
      );
    }

    const okPin = await verifyPin(parsed.data.pin, found.member.pin_hash);
    const { ip, userAgent } = requestMeta(req);
    if (!okPin) {
      await auditLog({
        memberUuid: found.member.member_uuid,
        eventType: "pin_failed",
        ip,
        userAgent,
      });
      return NextResponse.json({ ok: false, error: "Incorrect PIN" }, { status: 401 });
    }

    const jar = await cookies();
    const deviceId =
      parsed.data.deviceId ||
      jar.get(MEMBER_DEVICE_COOKIE)?.value ||
      randomToken(16);

    const session = await issueSession({
      member: found.member,
      deviceId,
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

    return NextResponse.json({ ok: true, deviceId });
  } catch (error) {
    console.error("pin/login", error);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
