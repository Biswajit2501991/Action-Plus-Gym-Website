import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
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
  verifyReceiptShare,
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
  ctx: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await ctx.params;
  const token = decodeURIComponent(String(raw || "").trim());
  const claims = verifyReceiptShare(token);
  if (!claims) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px;background:#0b0d10;color:#fff">
        <h1>Receipt unavailable</h1>
        <p>This share link is invalid or has expired. Ask the member to share again from the Member Portal.</p>
      </body></html>`,
      {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const columns =
    "id, external_payment_id, paid_at, amount, method, paid_month, billing_month, billing_date, note, member_id";
  const baseQuery = () =>
    svc.client
      .from("member_payment_history")
      .select(columns)
      .eq("gym_id", claims.gid)
      .eq("member_id", claims.mid);

  const byExternal = await baseQuery()
    .eq("external_payment_id", claims.pid)
    .maybeSingle();
  if (byExternal.error) {
    return NextResponse.json(
      { ok: false, error: byExternal.error.message },
      { status: 500 },
    );
  }

  let row = byExternal.data;
  if (!row && /^\d+$/.test(claims.pid)) {
    const byId = await baseQuery().eq("id", claims.pid).maybeSingle();
    if (byId.error) {
      return NextResponse.json(
        { ok: false, error: byId.error.message },
        { status: 500 },
      );
    }
    row = byId.data;
  }

  if (!row) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px;background:#0b0d10;color:#fff">
        <h1>Receipt not found</h1>
        <p>This payment could not be found. Contact Action Plus Gym for help.</p>
      </body></html>`,
      {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  const { data: member } = await svc.client
    .from("members")
    .select("full_name, member_code, plan_name, assigned_gym_code_id")
    .eq("id", claims.mid)
    .eq("gym_id", claims.gid)
    .maybeSingle();

  const branch = await branchLabel(member?.assigned_gym_code_id || null);
  const gym = await loadGymContact(svc.client, claims.gid);
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
  const planName = String(member?.plan_name || "").trim() || "—";
  const memberName = String(member?.full_name || "").trim() || "—";
  const memberCode = String(member?.member_code || "").trim() || "—";
  const branchName = String(branch || "").trim() || "—";

  const shareUrl = `${siteOrigin(req)}/r/${encodeURIComponent(token)}`;
  const fingerprint = receiptFingerprint({
    gymId: claims.gid,
    memberId: claims.mid,
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

  const html = renderReceiptHtml({
    receipt,
    shareUrl,
    backHref: null,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
