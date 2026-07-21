import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";
import { branchLabel } from "@/lib/member-portal/members";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  const { id } = await ctx.params;
  const paymentId = String(id || "").trim();
  if (!paymentId) {
    return NextResponse.json({ ok: false, error: "id-required" }, { status: 400 });
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const { data: row, error } = await svc.client
    .from("member_payment_history")
    .select(
      "id, external_payment_id, paid_at, amount, method, paid_month, billing_month, billing_date, note, recorded_by, source, created_at",
    )
    .eq("gym_id", portalGymId())
    .eq("member_id", session.member.id)
    .or(`external_payment_id.eq.${paymentId},id.eq.${paymentId}`)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  const branch = await branchLabel(session.member.assigned_gym_code_id);
  const amount = Number(row.amount || 0).toFixed(2);
  const paidAt = row.paid_at
    ? new Date(row.paid_at).toLocaleString("en-IN")
    : "—";
  const receiptId = String(row.external_payment_id || row.id);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Receipt ${receiptId}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 480px; margin: 40px auto; color: #111; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .muted { color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    td { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; }
    td:last-child { text-align: right; }
    .total { font-size: 18px; font-weight: bold; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()">Print / Save PDF</button>
  <h1>Action Plus Gym</h1>
  <p class="muted">Payment receipt</p>
  <table>
    <tr><td>Receipt</td><td>${receiptId}</td></tr>
    <tr><td>Member</td><td>${session.member.full_name}</td></tr>
    <tr><td>Member ID</td><td>${session.member.member_code}</td></tr>
    <tr><td>Branch</td><td>${branch || "—"}</td></tr>
    <tr><td>Paid at</td><td>${paidAt}</td></tr>
    <tr><td>Method</td><td>${row.method || "—"}</td></tr>
    <tr><td>Billing month</td><td>${row.paid_month || row.billing_month || "—"}</td></tr>
    <tr><td>Note</td><td>${row.note || "—"}</td></tr>
    <tr class="total"><td>Amount</td><td>₹${amount}</td></tr>
  </table>
  <p class="muted" style="margin-top:24px">Managed by Action Plus Gym. Contact the gym for corrections.</p>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
