import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession, auditLog } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";

async function getOrCreateThread(memberUuid: string, gymId: string) {
  const svc = createServiceRoleClient();
  if (!svc.ok) return { ok: false as const, error: svc.error };
  const { data: existing } = await svc.client
    .from("member_portal_chat_threads")
    .select("id, status, subject, updated_at")
    .eq("gym_id", gymId)
    .eq("member_uuid", memberUuid)
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true as const, thread: existing, client: svc.client };

  const { data: created, error } = await svc.client
    .from("member_portal_chat_threads")
    .insert({
      gym_id: gymId,
      member_uuid: memberUuid,
      subject: "Member portal chat",
      status: "open",
    })
    .select("id, status, subject, updated_at")
    .maybeSingle();
  if (error || !created) {
    return { ok: false as const, error: error?.message || "create-failed" };
  }
  return { ok: true as const, thread: created, client: svc.client };
}

export async function GET() {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  const threadRes = await getOrCreateThread(
    session.member.member_uuid,
    portalGymId(),
  );
  if (!threadRes.ok) {
    return NextResponse.json({ ok: false, error: threadRes.error }, { status: 500 });
  }

  const { data: messages, error } = await threadRes.client
    .from("member_portal_chat_messages")
    .select("id, sender, body, staff_name, created_at")
    .eq("thread_id", threadRes.thread.id)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    thread: threadRes.thread,
    messages: messages || [],
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

  let body = "";
  try {
    const json = await req.json();
    body = String(json?.body || "").trim().slice(0, 2000);
  } catch {
    body = "";
  }
  if (!body) {
    return NextResponse.json({ ok: false, error: "body-required" }, { status: 400 });
  }

  const threadRes = await getOrCreateThread(
    session.member.member_uuid,
    portalGymId(),
  );
  if (!threadRes.ok) {
    return NextResponse.json({ ok: false, error: threadRes.error }, { status: 500 });
  }

  const { data, error } = await threadRes.client
    .from("member_portal_chat_messages")
    .insert({
      gym_id: portalGymId(),
      thread_id: threadRes.thread.id,
      sender: "member",
      body,
    })
    .select("id, sender, body, created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await threadRes.client
    .from("member_portal_chat_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadRes.thread.id);

  await auditLog({
    memberUuid: session.member.member_uuid,
    eventType: "chat_message_sent",
  });

  return NextResponse.json({ ok: true, message: data });
}
