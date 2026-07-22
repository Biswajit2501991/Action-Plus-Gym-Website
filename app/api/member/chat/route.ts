import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession, auditLog } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getRetentionDays(client: any, gymId: string) {
  const { data } = await client
    .from("member_portal_settings")
    .select("chat_retention_days")
    .eq("gym_id", gymId)
    .maybeSingle();
  const days = Number(data?.chat_retention_days);
  if (Number.isFinite(days) && days >= 1 && days <= 365) return Math.floor(days);
  return 7;
}

/**
 * One continuous chat per member: reuse the latest thread (any status),
 * reopen answered threads, and never orphan history by creating a parallel open thread.
 */
async function getOrCreateThread(memberUuid: string, gymId: string) {
  const svc = createServiceRoleClient();
  if (!svc.ok) return { ok: false as const, error: svc.error };
  const { data: existing } = await svc.client
    .from("member_portal_chat_threads")
    .select("id, status, subject, updated_at")
    .eq("gym_id", gymId)
    .eq("member_uuid", memberUuid)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (existing.status !== "open") {
      await svc.client
        .from("member_portal_chat_threads")
        .update({ status: "open", updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("gym_id", gymId);
      existing.status = "open";
    }
    return { ok: true as const, thread: existing, client: svc.client };
  }

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadAllMessagesForMember(client: any, gymId: string, memberUuid: string) {
  const { data: threads } = await client
    .from("member_portal_chat_threads")
    .select("id")
    .eq("gym_id", gymId)
    .eq("member_uuid", memberUuid);
  const ids = (threads || []).map((t: { id: string }) => t.id);
  if (!ids.length) return [];

  const { data: messages, error } = await client
    .from("member_portal_chat_messages")
    .select("id, sender, body, staff_name, created_at, thread_id")
    .eq("gym_id", gymId)
    .in("thread_id", ids)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message);
  return messages || [];
}

export async function GET() {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  const gymId = portalGymId();
  const threadRes = await getOrCreateThread(session.member.member_uuid, gymId);
  if (!threadRes.ok) {
    return NextResponse.json({ ok: false, error: threadRes.error }, { status: 500 });
  }

  try {
    const [messages, retentionDays] = await Promise.all([
      loadAllMessagesForMember(
        threadRes.client,
        gymId,
        session.member.member_uuid,
      ),
      getRetentionDays(threadRes.client, gymId),
    ]);

    return NextResponse.json({
      ok: true,
      thread: threadRes.thread,
      messages,
      retentionDays,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "load-failed" },
      { status: 500 },
    );
  }
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

  const gymId = portalGymId();
  const threadRes = await getOrCreateThread(session.member.member_uuid, gymId);
  if (!threadRes.ok) {
    return NextResponse.json({ ok: false, error: threadRes.error }, { status: 500 });
  }

  const { data, error } = await threadRes.client
    .from("member_portal_chat_messages")
    .insert({
      gym_id: gymId,
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
    .update({
      updated_at: new Date().toISOString(),
      status: "open",
    })
    .eq("id", threadRes.thread.id);

  await auditLog({
    memberUuid: session.member.member_uuid,
    eventType: "chat_message_sent",
  });

  return NextResponse.json({ ok: true, message: data });
}
