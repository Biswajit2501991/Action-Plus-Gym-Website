import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession, auditLog } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";

export async function GET(req: Request) {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  const url = new URL(req.url);
  const month = String(url.searchParams.get("month") || "").trim(); // YYYY-MM optional

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  let q = svc.client
    .from("member_attendance_records")
    .select("id, checked_in_at, source, branch_id, note")
    .eq("gym_id", portalGymId())
    .eq("member_uuid", session.member.member_uuid)
    .order("checked_in_at", { ascending: false })
    .limit(200);

  if (/^\d{4}-\d{2}$/.test(month)) {
    const start = `${month}-01T00:00:00.000Z`;
    const [y, m] = month.split("-").map(Number);
    const endDate = new Date(Date.UTC(y, m, 1));
    q = q.gte("checked_in_at", start).lt("checked_in_at", endDate.toISOString());
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await auditLog({
    memberUuid: session.member.member_uuid,
    eventType: "attendance_viewed",
  });

  return NextResponse.json({ ok: true, items: data || [] });
}

/** Member scans gym presence QR / redeem ticket → check-in */
export async function POST(req: Request) {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  let body: { presenceTicket?: string; token?: string; deviceId?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  // Prefer already-redeemed presence ticket; optionally accept raw token and trust gym QR context.
  const presenceTicket = String(body.presenceTicket || body.token || "").trim();
  if (!presenceTicket) {
    return NextResponse.json(
      { ok: false, error: "presence-ticket-required" },
      { status: 400 },
    );
  }

  // Dedupe: one check-in per member per 30 minutes
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recent } = await svc.client
    .from("member_attendance_records")
    .select("id")
    .eq("gym_id", portalGymId())
    .eq("member_uuid", session.member.member_uuid)
    .gte("checked_in_at", since)
    .limit(1);
  if (recent?.length) {
    return NextResponse.json({
      ok: true,
      deduped: true,
      message: "Already checked in recently.",
    });
  }

  const { data, error } = await svc.client
    .from("member_attendance_records")
    .insert({
      gym_id: portalGymId(),
      member_uuid: session.member.member_uuid,
      branch_id: session.member.assigned_gym_code_id || null,
      source: "member_scan",
      device_id: body.deviceId || null,
      note: `presence:${presenceTicket.slice(0, 24)}`,
    })
    .select("id, checked_in_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await auditLog({
    memberUuid: session.member.member_uuid,
    eventType: "attendance_checkin_member_scan",
    meta: { recordId: data?.id },
  });

  return NextResponse.json({ ok: true, record: data });
}
