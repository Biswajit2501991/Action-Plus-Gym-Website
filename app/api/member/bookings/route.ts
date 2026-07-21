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

  const gymId = portalGymId();
  const now = new Date().toISOString();

  const { data: slots, error } = await svc.client
    .from("member_booking_slots")
    .select("id, title, starts_at, ends_at, capacity, branch_id")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .gte("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data: mine } = await svc.client
    .from("member_bookings")
    .select("id, slot_id, status, created_at")
    .eq("gym_id", gymId)
    .eq("member_uuid", session.member.member_uuid);

  return NextResponse.json({
    ok: true,
    slots: slots || [],
    myBookings: mine || [],
  });
}

export async function POST(req: Request) {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  let slotId = "";
  try {
    const json = await req.json();
    slotId = String(json?.slotId || "").trim();
  } catch {
    slotId = "";
  }
  if (!slotId) {
    return NextResponse.json({ ok: false, error: "slot-required" }, { status: 400 });
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const gymId = portalGymId();
  const { data: slot } = await svc.client
    .from("member_booking_slots")
    .select("id, capacity, is_active, starts_at")
    .eq("id", slotId)
    .eq("gym_id", gymId)
    .maybeSingle();
  if (!slot || !slot.is_active) {
    return NextResponse.json({ ok: false, error: "slot-not-found" }, { status: 404 });
  }

  const { count } = await svc.client
    .from("member_bookings")
    .select("id", { count: "exact", head: true })
    .eq("slot_id", slotId)
    .eq("status", "booked");

  if ((count || 0) >= Number(slot.capacity || 0)) {
    return NextResponse.json({ ok: false, error: "slot-full" }, { status: 409 });
  }

  const { data, error } = await svc.client
    .from("member_bookings")
    .upsert(
      {
        gym_id: gymId,
        slot_id: slotId,
        member_uuid: session.member.member_uuid,
        status: "booked",
      },
      { onConflict: "slot_id,member_uuid" },
    )
    .select("id, slot_id, status")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await auditLog({
    memberUuid: session.member.member_uuid,
    eventType: "booking_created",
    meta: { slotId },
  });

  return NextResponse.json({ ok: true, booking: data });
}
