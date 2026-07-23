import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";

function isPtPlanName(planName: string | null | undefined) {
  return /\bpt\b/i.test(String(planName || "").trim());
}

function todayKeyIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeDate(input: unknown) {
  const s = String(input || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function normalizeWeightKg(input: unknown) {
  const n = typeof input === "number" ? input : Number(String(input || "").trim());
  if (!Number.isFinite(n) || n <= 0 || n > 400) return null;
  return Math.round(n * 10) / 10;
}

async function loadMemberPlan(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (table: string) => any },
  gymId: string,
  uuid: string,
) {
  const { data, error } = await client
    .from("members")
    .select("plan_name, status")
    .eq("gym_id", gymId)
    .eq("member_uuid", uuid)
    .maybeSingle();
  if (error) throw new Error(error.message || "member-lookup-failed");
  return data as { plan_name?: string | null; status?: string | null } | null;
}

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

  try {
    const member = await loadMemberPlan(svc.client, gymId, uuid);
    const planName = String(member?.plan_name || "").trim();
    const onPtPlan = isPtPlanName(planName);
    const canEdit = !onPtPlan;

    const { data, error } = await svc.client
      .from("member_measurements")
      .select("id, measured_at, weight_kg, notes, recorded_by, created_at")
      .eq("gym_id", gymId)
      .eq("member_uuid", uuid)
      .not("weight_kg", "is", null)
      .order("measured_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "weight-load-failed" },
        { status: 500 },
      );
    }

    const logs = (data || []).map((row) => ({
      id: String(row.id),
      date: String(row.measured_at || "").slice(0, 10),
      weightKg: row.weight_kg != null ? Number(row.weight_kg) : null,
      notes: row.notes ? String(row.notes) : "",
      recordedBy: row.recorded_by ? String(row.recorded_by) : "",
      createdAt: row.created_at ? String(row.created_at) : "",
    }));

    const current = logs[0]?.weightKg ?? null;
    const previous = logs[1]?.weightKg ?? null;
    const changeKg =
      current != null && previous != null
        ? Math.round((current - previous) * 10) / 10
        : null;

    return NextResponse.json({
      ok: true,
      planName: planName || null,
      onPtPlan,
      canEdit,
      logs,
      currentKg: current,
      previousKg: previous,
      changeKg,
      today: todayKeyIndia(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "weight-load-failed" },
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

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const gymId = portalGymId();
  const uuid = session.member.member_uuid;

  let body: { date?: string; weightKg?: number | string; notes?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  try {
    const member = await loadMemberPlan(svc.client, gymId, uuid);
    const planName = String(member?.plan_name || "").trim();
    if (isPtPlanName(planName)) {
      return NextResponse.json(
        {
          ok: false,
          error: "pt-plan-readonly",
          message: "Weight Tracker is for Basic members. PT clients use the trainer Weight Progress tab.",
        },
        { status: 403 },
      );
    }

    const status = String(member?.status || "").trim().toLowerCase();
    if (status === "deactivated" || status === "cancelled") {
      return NextResponse.json(
        { ok: false, error: "member-inactive", message: "Membership is not active." },
        { status: 403 },
      );
    }

    const measuredAt = normalizeDate(body.date) || todayKeyIndia();
    const weightKg = normalizeWeightKg(body.weightKg);
    if (weightKg == null) {
      return NextResponse.json(
        { ok: false, error: "invalid-weight", message: "Enter a valid weight in kg." },
        { status: 400 },
      );
    }

    const notes = String(body.notes || "").trim().slice(0, 300);

    // Previous log before insert (for change calc).
    const { data: priorRows } = await svc.client
      .from("member_measurements")
      .select("weight_kg, measured_at, created_at")
      .eq("gym_id", gymId)
      .eq("member_uuid", uuid)
      .not("weight_kg", "is", null)
      .order("measured_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    const previousKg =
      priorRows?.[0]?.weight_kg != null ? Number(priorRows[0].weight_kg) : null;

    const { data: inserted, error } = await svc.client
      .from("member_measurements")
      .insert({
        gym_id: gymId,
        member_uuid: uuid,
        measured_at: measuredAt,
        weight_kg: weightKg,
        notes: notes || null,
        metrics_json: { source: "member_portal" },
        recorded_by: "member",
      })
      .select("id, measured_at, weight_kg, notes, recorded_by, created_at")
      .single();

    if (error || !inserted) {
      return NextResponse.json(
        { ok: false, error: error?.message || "weight-save-failed" },
        { status: 500 },
      );
    }

    const changeKg =
      previousKg != null
        ? Math.round((weightKg - previousKg) * 10) / 10
        : null;

    return NextResponse.json({
      ok: true,
      log: {
        id: String(inserted.id),
        date: String(inserted.measured_at || "").slice(0, 10),
        weightKg: Number(inserted.weight_kg),
        notes: inserted.notes ? String(inserted.notes) : "",
        recordedBy: inserted.recorded_by ? String(inserted.recorded_by) : "member",
        createdAt: inserted.created_at ? String(inserted.created_at) : "",
      },
      currentKg: weightKg,
      previousKg,
      changeKg,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "weight-save-failed" },
      { status: 500 },
    );
  }
}
