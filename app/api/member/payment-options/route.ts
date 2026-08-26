import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";
import {
  extractUpiId,
  isMissingPaymentQrPortalColumn,
} from "@/lib/member-portal/payment-qr-upi";

type QrRow = {
  id: string;
  qr_name: string | null;
  upi_id?: string | null;
  qr_image_path: string | null;
  gym_code_id: string | null;
  display_order: number | null;
};

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

  const gymId = portalGymId();
  const branchId = String(session.member.assigned_gym_code_id || "").trim();

  let query = svc.client
    .from("payment_qr_settings")
    .select("id, qr_name, upi_id, qr_image_path, gym_code_id, display_order")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .eq("show_in_member_portal", true)
    .order("display_order", { ascending: true })
    .order("qr_name", { ascending: true });

  if (branchId) {
    query = query.eq("gym_code_id", branchId);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingPaymentQrPortalColumn(error)) {
      return NextResponse.json({ ok: true, items: [] });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data || []) as QrRow[];

  const items = await Promise.all(
    rows.map(async (row) => {
      const path = String(row.qr_image_path || "").trim();
      let imageUrl: string | null = null;
      if (path) {
        const signed = await svc.client.storage
          .from("apg-media")
          .createSignedUrl(path, 60 * 30);
        imageUrl = signed.data?.signedUrl || null;
      }
      const name = String(row.qr_name || "Payment QR");
      return {
        id: String(row.id),
        name,
        upiId: extractUpiId(row.upi_id, name),
        imageUrl,
      };
    }),
  );

  return NextResponse.json({ ok: true, items });
}
