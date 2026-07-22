import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { memberJwtSecret, portalGymId } from "@/lib/member-portal/config";
import { branchLabel } from "@/lib/member-portal/members";
import { randomToken } from "@/lib/member-portal/crypto";

export async function GET() {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  const member = session.member;
  let qrToken = member.qr_token;
  if (!qrToken) {
    qrToken = randomToken(32);
    const svc = createServiceRoleClient();
    if (svc.ok) {
      await svc.client
        .from("members")
        .update({ qr_token: qrToken })
        .eq("member_uuid", member.member_uuid);
    }
  }

  const branch = await branchLabel(member.assigned_gym_code_id);
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    gymId: portalGymId(),
    memberUuid: member.member_uuid,
    memberCode: member.member_code,
    name: member.full_name,
    status: member.status,
    branch,
    qrToken,
    iat: issuedAt,
    exp: issuedAt + 60 * 60 * 12,
  };

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", memberJwtSecret()).update(body).digest("base64url");
  const qrPayload = `APG1.${body}.${sig}`;

  let photoUrl: string | null = member.photo_url || null;
  if (member.photo_path) {
    const svc = createServiceRoleClient();
    if (svc.ok) {
      const { data } = await svc.client.storage
        .from("apg-media")
        .createSignedUrl(member.photo_path, 60 * 30);
      if (data?.signedUrl) photoUrl = data.signedUrl;
    }
  }

  return NextResponse.json({
    ok: true,
    card: {
      memberCode: member.member_code,
      fullName: member.full_name,
      status: member.status,
      planName: member.plan_name,
      branch,
      paymentBy: member.payment_by,
      nextPaymentDate: member.next_payment_date,
      photoUrl,
      qrPayload,
    },
  });
}
