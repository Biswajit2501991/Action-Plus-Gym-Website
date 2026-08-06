import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession, auditLog } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";

type PtChatMessage = {
  id: string;
  by?: string;
  text?: string;
  ts?: string;
  from?: "trainer" | "member";
};

function isPtPlanName(planName: string | null | undefined) {
  return /\bpt\b/i.test(String(planName || "").trim());
}

function normalizeChatList(raw: unknown): PtChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: PtChatMessage[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const msg = row as PtChatMessage;
    const text = String(msg.text || "").trim();
    if (!text) continue;
    const from =
      msg.from === "member" ? "member" : msg.from === "trainer" ? "trainer" : "trainer";
    out.push({
      id: String(msg.id || randomUUID()),
      by: String(msg.by || (from === "member" ? "Member" : "Trainer")).slice(0, 80),
      text: text.slice(0, 2000),
      ts: msg.ts ? String(msg.ts) : new Date().toISOString(),
      from,
    });
  }
  return out.slice(0, 100);
}

/** Chronological (oldest → newest) for UI. Stored newest-first in plan_json. */
function chronological(messages: PtChatMessage[]) {
  return [...messages].reverse();
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
  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const { data: member, error: memberErr } = await svc.client
    .from("members")
    .select("id, plan_name, full_name, member_uuid")
    .eq("gym_id", gymId)
    .eq("member_uuid", session.member.member_uuid)
    .maybeSingle();

  if (memberErr) {
    return NextResponse.json(
      { ok: false, error: memberErr.message || "member-lookup-failed" },
      { status: 500 },
    );
  }
  if (!member?.id) {
    return NextResponse.json({ ok: false, error: "member-not-found" }, { status: 404 });
  }
  if (!isPtPlanName(member.plan_name)) {
    return NextResponse.json(
      { ok: false, error: "PT chat is only available on a PT plan." },
      { status: 403 },
    );
  }

  const { data: profileRow, error: profileErr } = await svc.client
    .from("pt_client_profiles")
    .select(
      "id, member_id, chat:plan_json->chat, lastTrainerChatAt:plan_json->lastTrainerChatAt",
    )
    .eq("gym_id", gymId)
    .eq("member_id", member.id)
    .maybeSingle();

  if (profileErr) {
    return NextResponse.json({ ok: false, error: profileErr.message }, { status: 500 });
  }

  const messages = normalizeChatList(profileRow?.chat);
  const latestTrainer = messages.find((m) => m.from !== "member") || null;

  return NextResponse.json({
    ok: true,
    messages: chronological(messages),
    latestTrainerAt: latestTrainer?.ts || null,
    latestTrainerAtMs: latestTrainer?.ts
      ? Date.parse(String(latestTrainer.ts).replace(" ", "T")) || null
      : null,
    memberUuid: session.member.member_uuid,
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

  let body: { text?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const text = String(body.text || "").trim();
  if (text.length < 1 || text.length > 2000) {
    return NextResponse.json(
      { ok: false, error: "Enter a message (1–2000 characters)." },
      { status: 400 },
    );
  }

  const gymId = portalGymId();
  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const { data: member, error: memberErr } = await svc.client
    .from("members")
    .select("id, plan_name, full_name, member_uuid")
    .eq("gym_id", gymId)
    .eq("member_uuid", session.member.member_uuid)
    .maybeSingle();

  if (memberErr) {
    return NextResponse.json(
      { ok: false, error: memberErr.message || "member-lookup-failed" },
      { status: 500 },
    );
  }
  if (!member?.id) {
    return NextResponse.json({ ok: false, error: "member-not-found" }, { status: 404 });
  }
  if (!isPtPlanName(member.plan_name)) {
    return NextResponse.json(
      { ok: false, error: "PT chat is only available on a PT plan." },
      { status: 403 },
    );
  }

  const { data: profileRow } = await svc.client
    .from("pt_client_profiles")
    .select("id, plan_json")
    .eq("gym_id", gymId)
    .eq("member_id", member.id)
    .maybeSingle();

  const prev =
    profileRow?.plan_json && typeof profileRow.plan_json === "object"
      ? (profileRow.plan_json as Record<string, unknown>)
      : {};
  const nowIso = new Date().toISOString();
  const nextMsg: PtChatMessage = {
    id: randomUUID(),
    by: String(member.full_name || "Member").slice(0, 80),
    text,
    ts: nowIso,
    from: "member",
  };
  const chat = [nextMsg, ...normalizeChatList(prev.chat)].slice(0, 100);
  const planJson = {
    ...prev,
    chat,
    lastChatAt: nowIso,
    lastMemberChatAt: nowIso,
    updatedAt: nowIso,
  };

  // Table may only have PK on id (no unique on gym_id+member_id) — update/insert like Gym Manager.
  if (profileRow?.id) {
    const { error: updErr } = await svc.client
      .from("pt_client_profiles")
      .update({
        plan_json: planJson,
        updated_at: nowIso,
      })
      .eq("id", profileRow.id)
      .eq("gym_id", gymId);
    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }
  } else {
    const { error: insErr } = await svc.client.from("pt_client_profiles").insert({
      gym_id: gymId,
      member_id: member.id,
      plan_json: planJson,
      updated_at: nowIso,
    });
    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }
  }

  await auditLog({
    memberUuid: session.member.member_uuid,
    eventType: "pt_chat_member_message",
  });

  return NextResponse.json({
    ok: true,
    messages: chronological(chat),
  });
}
