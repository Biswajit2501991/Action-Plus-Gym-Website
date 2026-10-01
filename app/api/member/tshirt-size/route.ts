import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";
import {
  effectivePortalSections,
  loadBranchPortalSettingsRow,
} from "@/lib/member-portal/branch-portal-access";
import { fetchExerciseTypeLookupValues } from "@/lib/member-portal/portal-home-tile-markers";
import { portalSectionsFromSettings } from "@/lib/member-portal/portal-ui-config";
import {
  TSHIRT_SIZE_SAVE_LIMIT,
  TSHIRT_SIZES,
  normalizeTshirtSize,
} from "@/lib/member-portal/tshirt-size";

const tileEnabledCache = new Map<string, { at: number; enabled: boolean }>();
const TILE_ENABLED_TTL_MS = 20_000;

async function tshirtTileEnabled(client: SupabaseClient, assignedGymCodeId: string | null) {
  const key = `${portalGymId()}:${assignedGymCodeId || ""}`;
  const hit = tileEnabledCache.get(key);
  if (hit && Date.now() - hit.at < TILE_ENABLED_TTL_MS) return hit.enabled;
  try {
    const gymId = portalGymId();
    const [exerciseTypes, settingsRes, branchRow] = await Promise.all([
      fetchExerciseTypeLookupValues(client).catch(() => [] as string[]),
      client
        .from("member_portal_settings")
        .select("portal_sections, basic_workout_options")
        .eq("gym_id", gymId)
        .maybeSingle(),
      loadBranchPortalSettingsRow(assignedGymCodeId),
    ]);
    const gymWide = portalSectionsFromSettings({
      portal_sections: settingsRes.data?.portal_sections,
      basic_workout_options: settingsRes.data?.basic_workout_options,
      exerciseTypes,
    });
    const enabled = effectivePortalSections(gymWide, branchRow).homeTshirt !== false;
    tileEnabledCache.set(key, { at: Date.now(), enabled });
    return enabled;
  } catch {
    return true;
  }
}

function missingColumn(message: string) {
  return /tshirt_size/i.test(message) && /column|schema cache|does not exist/i.test(message);
}

function payload(row: { tshirt_size?: string | null; tshirt_size_updates?: number | null }) {
  const size = normalizeTshirtSize(row.tshirt_size);
  const updates = Math.max(0, Number(row.tshirt_size_updates) || 0);
  return {
    ok: true as const,
    size,
    updates,
    limit: TSHIRT_SIZE_SAVE_LIMIT,
    locked: updates >= TSHIRT_SIZE_SAVE_LIMIT,
    options: TSHIRT_SIZES,
  };
}

export async function GET() {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json({ ok: false, error: session.error }, { status: session.status });
  }
  const svc = createServiceRoleClient();
  if (!svc.ok) return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  const [enabled, memberRow] = await Promise.all([
    tshirtTileEnabled(svc.client, session.member.assigned_gym_code_id),
    svc.client
      .from("members")
      .select("tshirt_size, tshirt_size_updates")
      .eq("gym_id", portalGymId())
      .eq("member_uuid", session.member.member_uuid)
      .maybeSingle(),
  ]);
  if (!enabled) {
    return NextResponse.json({ ok: false, error: "tshirt-hidden" }, { status: 403 });
  }

  const { data, error } = memberRow;

  if (error) {
    const message = error.message || "tshirt-load-failed";
    return NextResponse.json(
      { ok: false, error: missingColumn(message) ? "tshirt-storage-not-ready" : message },
      { status: missingColumn(message) ? 503 : 500 },
    );
  }
  if (!data) return NextResponse.json({ ok: false, error: "member-not-found" }, { status: 404 });
  return NextResponse.json(payload(data));
}

export async function POST(request: Request) {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json({ ok: false, error: session.error }, { status: session.status });
  }
  const body = (await request.json().catch(() => null)) as { size?: unknown } | null;
  const size = normalizeTshirtSize(body?.size);
  if (!size) {
    return NextResponse.json({ ok: false, error: "invalid-size" }, { status: 400 });
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  const gymId = portalGymId();
  const uuid = session.member.member_uuid;
  const [enabled, current] = await Promise.all([
    tshirtTileEnabled(svc.client, session.member.assigned_gym_code_id),
    svc.client
      .from("members")
      .select("tshirt_size, tshirt_size_updates")
      .eq("gym_id", gymId)
      .eq("member_uuid", uuid)
      .maybeSingle(),
  ]);
  if (!enabled) {
    return NextResponse.json({ ok: false, error: "tshirt-hidden" }, { status: 403 });
  }

  if (current.error) {
    const message = current.error.message || "tshirt-load-failed";
    return NextResponse.json(
      { ok: false, error: missingColumn(message) ? "tshirt-storage-not-ready" : message },
      { status: missingColumn(message) ? 503 : 500 },
    );
  }
  if (!current.data) {
    return NextResponse.json({ ok: false, error: "member-not-found" }, { status: 404 });
  }

  const updates = Math.max(0, Number(current.data.tshirt_size_updates) || 0);
  if (updates >= TSHIRT_SIZE_SAVE_LIMIT) {
    return NextResponse.json(
      { ...payload(current.data), ok: false, error: "locked" },
      { status: 409 },
    );
  }
  if (normalizeTshirtSize(current.data.tshirt_size) === size) {
    return NextResponse.json(payload(current.data));
  }

  const saved = await svc.client
    .from("members")
    .update({ tshirt_size: size, tshirt_size_updates: updates + 1 })
    .eq("gym_id", gymId)
    .eq("member_uuid", uuid)
    .eq("tshirt_size_updates", updates)
    .select("tshirt_size, tshirt_size_updates")
    .maybeSingle();

  if (saved.error) {
    const message = saved.error.message || "tshirt-save-failed";
    return NextResponse.json(
      { ok: false, error: missingColumn(message) ? "tshirt-storage-not-ready" : message },
      { status: missingColumn(message) ? 503 : 500 },
    );
  }
  if (!saved.data) {
    return NextResponse.json({ ok: false, error: "locked" }, { status: 409 });
  }
  return NextResponse.json(payload(saved.data));
}
