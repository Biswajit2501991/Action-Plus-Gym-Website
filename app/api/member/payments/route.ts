import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession, auditLog } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";

export async function GET() {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const { data, error } = await svc.client
    .from("member_payment_history")
    .select(
      "id, external_payment_id, paid_at, amount, method, paid_month, billing_month, billing_date, note, recorded_by, source, created_at",
    )
    .eq("gym_id", portalGymId())
    .eq("member_id", session.member.id)
    .order("paid_at", { ascending: false })
    .limit(3);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await auditLog({
    memberUuid: session.member.member_uuid,
    eventType: "payments_viewed",
  });

  const items = (data || []).map((row) => ({
    id: String(row.external_payment_id || row.id),
    paidAt: row.paid_at,
    amount: Number(row.amount || 0),
    method: row.method || null,
    paidMonth: row.paid_month || row.billing_month || null,
    billingDate: row.billing_date || null,
    note: row.note || null,
    recordedBy: row.recorded_by || null,
  }));

  return NextResponse.json({ ok: true, items });
}
