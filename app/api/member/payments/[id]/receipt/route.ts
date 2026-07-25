import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";
import { branchLabel } from "@/lib/member-portal/members";
import {
  buildReceiptQrDataUrl,
  buildReceiptShareText,
  formatMembershipPeriod,
  formatReceiptAmount,
  formatReceiptPaidAt,
  loadGymContact,
  receiptFingerprint,
  renderReceiptHtml,
  signReceiptShare,
  type ReceiptViewModel,
} from "@/lib/member-portal/receipt-share";

function siteOrigin(req: Request): string {
  const env = String(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return "https://actionplusgym.com";
}

export async function GET(
  req: Request,
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

  const columns =
    "id, external_payment_id, paid_at, amount, method, paid_month, billing_month, billing_date, note, recorded_by, source, created_at";
  const baseQuery = () =>
    svc.client
      .from("member_payment_history")
      .select(columns)
      .eq("gym_id", portalGymId())
      .eq("member_id", session.member.id);

  const byExternal = await baseQuery()
    .eq("external_payment_id", paymentId)
    .maybeSingle();
  if (byExternal.error) {
    return NextResponse.json(
      { ok: false, error: byExternal.error.message },
      { status: 500 },
    );
  }

  let row = byExternal.data;
  // `id` is a bigint column — only match it when the param is numeric.
  if (!row && /^\d+$/.test(paymentId)) {
    const byId = await baseQuery().eq("id", paymentId).maybeSingle();
    if (byId.error) {
      return NextResponse.json(
        { ok: false, error: byId.error.message },
        { status: 500 },
      );
    }
    row = byId.data;
  }

  if (!row) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  const branch = await branchLabel(session.member.assigned_gym_code_id);
  const gym = await loadGymContact(svc.client, portalGymId());
  const { amount, amountDisplay } = formatReceiptAmount(row.amount);
  const paidAt = formatReceiptPaidAt(row.paid_at);
  const receiptId = String(row.external_payment_id || row.id);
  const billingMonth = String(row.paid_month || row.billing_month || "").trim() || "—";
  const periodLabel = formatMembershipPeriod({
    paidMonth: row.paid_month,
    billingMonth: row.billing_month,
    billingDate: row.billing_date,
  });
  const method = String(row.method || "").trim() || "—";
  const note = String(row.note || "").trim() || "—";
  const planName = String(session.member.plan_name || "").trim() || "—";
  const memberName = String(session.member.full_name || "").trim() || "—";
  const memberCode = String(session.member.member_code || "").trim() || "—";
  const branchName = String(branch || "").trim() || "—";

  const token = signReceiptShare({
    gymId: portalGymId(),
    memberId: session.member.id,
    paymentId: receiptId,
  });
  const shareUrl = `${siteOrigin(req)}/r/${encodeURIComponent(token)}`;
  const fingerprint = receiptFingerprint({
    gymId: portalGymId(),
    memberId: session.member.id,
    paymentId: receiptId,
  });
  const qrDataUrl = await buildReceiptQrDataUrl(shareUrl);

  const base: Omit<ReceiptViewModel, "shareText" | "shareUrl"> = {
    receiptId,
    memberName,
    memberCode,
    planName,
    branchName,
    paidAt,
    method,
    billingMonth,
    periodLabel,
    note,
    amount,
    amountDisplay,
    fingerprint,
    qrDataUrl,
    gym,
  };
  const receipt: ReceiptViewModel = {
    ...base,
    shareText: buildReceiptShareText(base),
    shareUrl,
  };

  const wantsJson =
    new URL(req.url).searchParams.get("format")?.toLowerCase() === "json";
  if (wantsJson) {
    return NextResponse.json(
      { ok: true, receipt },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const html = renderReceiptHtml({
    receipt,
    shareUrl,
    backHref: "/members",
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
