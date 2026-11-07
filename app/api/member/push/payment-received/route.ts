import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";
import { authorizeInternalPushSecret } from "@/lib/member-portal/owner-broadcast";
import { notifySavedPayment } from "@/lib/member-portal/payment-received-push";

export const dynamic = "force-dynamic";

/**
 * Internal thank-you for one saved payment (Gym Manager proxy).
 * Auth: Authorization: Bearer $MEMBER_PORTAL_CRON_SECRET
 *
 * The amount and date are read from member_payment_history.
 * This does not write payments or send a gym-wide broadcast.
 */
export async function POST(req: Request) {
  if (!authorizeInternalPushSecret(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const gymId = portalGymId();
  if (!gymId) {
    return NextResponse.json({ ok: false, error: "gym-missing" }, { status: 500 });
  }

  let body: { memberUuid?: string; paymentId?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const result = await notifySavedPayment(svc.client, {
      gymId,
      memberUuid: String(body.memberUuid || ""),
      paymentId: String(body.paymentId || ""),
    });
    if (!result.ok) {
      const status = result.error === "payment-not-found" ? 404 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "payment-push-failed" },
      { status: 500 },
    );
  }
}
