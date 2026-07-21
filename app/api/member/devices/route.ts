import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  auditLog,
  requireMemberSession,
  requestMeta,
} from "@/lib/member-portal/session";

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
    .from("member_portal_devices")
    .select("id, device_id, label, trusted, last_seen_at, created_at, revoked_at")
    .eq("member_uuid", session.claims.mid)
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: "Could not load devices" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    devices: (data || []).map((d) => ({
      id: d.id,
      deviceId: d.device_id,
      label: d.label,
      trusted: d.trusted,
      lastSeenAt: d.last_seen_at,
      createdAt: d.created_at,
      current: d.device_id === session.claims.did,
    })),
  });
}

export async function DELETE(req: NextRequest) {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing device id" }, { status: 400 });
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const { data: device } = await svc.client
    .from("member_portal_devices")
    .select("id, device_id")
    .eq("id", id)
    .eq("member_uuid", session.claims.mid)
    .is("revoked_at", null)
    .maybeSingle();

  if (!device) {
    return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  await svc.client
    .from("member_portal_devices")
    .update({ revoked_at: now })
    .eq("id", device.id);

  await svc.client
    .from("member_portal_sessions")
    .update({ revoked_at: now })
    .eq("member_uuid", session.claims.mid)
    .eq("device_id", device.device_id)
    .is("revoked_at", null);

  const { ip, userAgent } = requestMeta(req);
  await auditLog({
    memberUuid: session.claims.mid,
    eventType: "device_removed",
    meta: { deviceId: device.device_id },
    ip,
    userAgent,
  });

  return NextResponse.json({ ok: true });
}
