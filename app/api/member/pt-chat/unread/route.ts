import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";

function isPtPlanName(planName: string | null | undefined) {
  return /\bpt\b/i.test(String(planName || "").trim());
}

/** Lightweight unread signal for Training home tile (trainer → member). */
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

  const { data: member } = await svc.client
    .from("members")
    .select("id, plan_name")
    .eq("gym_id", gymId)
    .eq("member_uuid", session.member.member_uuid)
    .maybeSingle();

  if (!member?.id || !isPtPlanName(member.plan_name)) {
    return NextResponse.json({
      ok: true,
      onPtPlan: false,
      latestTrainerAt: null,
      latestTrainerAtMs: null,
    });
  }

  const { data: profileRow } = await svc.client
    .from("pt_client_profiles")
    .select("plan_json")
    .eq("gym_id", gymId)
    .eq("member_id", member.id)
    .maybeSingle();

  const planJson =
    profileRow?.plan_json && typeof profileRow.plan_json === "object"
      ? (profileRow.plan_json as Record<string, unknown>)
      : {};
  const chat = Array.isArray(planJson.chat) ? planJson.chat : [];
  let latestTrainerAt: string | null = null;
  for (const row of chat) {
    if (!row || typeof row !== "object") continue;
    const msg = row as { from?: string; ts?: string };
    if (String(msg.from || "trainer") === "member") continue;
    const ts = String(msg.ts || "").trim();
    if (!ts) continue;
    if (!latestTrainerAt || (Date.parse(ts) || 0) > (Date.parse(latestTrainerAt) || 0)) {
      latestTrainerAt = ts;
    }
  }

  const latestTrainerAtMs = latestTrainerAt
    ? Date.parse(String(latestTrainerAt).replace(" ", "T")) || null
    : null;

  return NextResponse.json({
    ok: true,
    onPtPlan: true,
    latestTrainerAt,
    latestTrainerAtMs: Number.isFinite(latestTrainerAtMs) ? latestTrainerAtMs : null,
  });
}
