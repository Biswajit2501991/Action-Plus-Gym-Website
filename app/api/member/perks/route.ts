import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";
import { randomToken } from "@/lib/member-portal/crypto";

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
  const uuid = session.member.member_uuid;

  const { data: locker } = await svc.client
    .from("member_lockers")
    .select("id, locker_code, branch_id, status, notes")
    .eq("gym_id", gymId)
    .eq("member_uuid", uuid)
    .maybeSingle();

  let { data: referral } = await svc.client
    .from("member_referral_codes")
    .select("code, points")
    .eq("gym_id", gymId)
    .eq("member_uuid", uuid)
    .maybeSingle();

  if (!referral) {
    const code = `AP${String(session.member.member_code || "")
      .replace(/\W/g, "")
      .slice(-6)
      .toUpperCase()}${randomToken(3).slice(0, 3).toUpperCase()}`;
    const { data: created } = await svc.client
      .from("member_referral_codes")
      .insert({
        gym_id: gymId,
        member_uuid: uuid,
        code,
        points: 0,
      })
      .select("code, points")
      .maybeSingle();
    referral = created;
  }

  const { data: events } = await svc.client
    .from("member_referral_events")
    .select("id, points, note, created_at")
    .eq("gym_id", gymId)
    .eq("referrer_uuid", uuid)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    ok: true,
    locker: locker || null,
    referral: referral || null,
    referralEvents: events || [],
  });
}

/** Request a locker assignment (staff fulfills in Gym Manager). */
export async function POST(req: Request) {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  let note = "";
  try {
    const json = await req.json();
    note = String(json?.note || "Locker request").trim().slice(0, 200);
  } catch {
    note = "Locker request";
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  // Open/create thread then post locker request
  let { data: thread } = await svc.client
    .from("member_portal_chat_threads")
    .select("id")
    .eq("gym_id", portalGymId())
    .eq("member_uuid", session.member.member_uuid)
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!thread?.id) {
    const { data: created } = await svc.client
      .from("member_portal_chat_threads")
      .insert({
        gym_id: portalGymId(),
        member_uuid: session.member.member_uuid,
        subject: "Locker request",
        status: "open",
      })
      .select("id")
      .maybeSingle();
    thread = created;
  }

  if (thread?.id) {
    await svc.client.from("member_portal_chat_messages").insert({
      gym_id: portalGymId(),
      thread_id: thread.id,
      sender: "member",
      body: `Locker request: ${note}`,
    });
    await svc.client
      .from("member_portal_chat_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", thread.id);
  }

  return NextResponse.json({ ok: true, message: "Request sent to gym staff." });
}
