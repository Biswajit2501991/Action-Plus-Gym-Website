import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";
import {
  authorizeInternalPushSecret,
  clampBroadcastBody,
  clampBroadcastTitle,
  listBroadcastRecipientUuids,
  recentOwnerBroadcastAt,
  runOwnerBroadcast,
  OWNER_BROADCAST_COOLDOWN_MS,
} from "@/lib/member-portal/owner-broadcast";

export const dynamic = "force-dynamic";

/**
 * Internal owner broadcast (Gym Manager proxy).
 * Auth: Authorization: Bearer $MEMBER_PORTAL_CRON_SECRET
 *
 * GET  → recipient preview count
 * POST → send gym-wide Web Push to opted-in Active portal members
 */

export async function GET(req: Request) {
  if (!authorizeInternalPushSecret(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const gymId = portalGymId();
  if (!gymId) {
    return NextResponse.json({ ok: false, error: "gym-missing" }, { status: 500 });
  }

  try {
    const recipients = await listBroadcastRecipientUuids(svc.client, gymId);
    const recent = await recentOwnerBroadcastAt(svc.client, gymId);
    const cooldownRemainingMs = recent
      ? Math.max(0, OWNER_BROADCAST_COOLDOWN_MS - (Date.now() - recent.getTime()))
      : 0;
    return NextResponse.json({
      ok: true,
      recipients: recipients.length,
      cooldownRemainingMs,
      canBroadcast: cooldownRemainingMs === 0,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "count-failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!authorizeInternalPushSecret(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const gymId = portalGymId();
  if (!gymId) {
    return NextResponse.json({ ok: false, error: "gym-missing" }, { status: 500 });
  }

  let body: { title?: string; body?: string; url?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const title = clampBroadcastTitle(body.title);
  const message = clampBroadcastBody(body.body);
  if (!title || !message) {
    return NextResponse.json(
      { ok: false, error: "title-and-body-required" },
      { status: 400 },
    );
  }

  try {
    const result = await runOwnerBroadcast(svc.client, {
      gymId,
      title,
      body: message,
      url: typeof body.url === "string" ? body.url : "/members",
    });
    return NextResponse.json({ ok: true, ...result, title, body: message });
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status?: number }).status) || 500
        : 500;
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code || "")
        : "";
    return NextResponse.json(
      {
        ok: false,
        error: code || (err instanceof Error ? err.message : "broadcast-failed"),
        message: err instanceof Error ? err.message : "broadcast-failed",
      },
      { status },
    );
  }
}
