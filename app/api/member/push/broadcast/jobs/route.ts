import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";
import { authorizeInternalPushSecret } from "@/lib/member-portal/owner-broadcast";
import {
  cancelBroadcastJob,
  createBroadcastJob,
  listBroadcastJobs,
} from "@/lib/member-portal/broadcast-jobs";

export const dynamic = "force-dynamic";

/**
 * Internal scheduled broadcast jobs (Gym Manager proxy).
 * Auth: Authorization: Bearer $MEMBER_PORTAL_CRON_SECRET
 *
 * GET  → list jobs
 * POST → create scheduled job { title, body, url?, scheduledAt, createdBy? }
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
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") || 40);
    const jobs = await listBroadcastJobs(svc.client, gymId, limit);
    return NextResponse.json({ ok: true, jobs });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "list-failed" },
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

  let body: {
    title?: string;
    body?: string;
    url?: string;
    scheduledAt?: string;
    createdBy?: string;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const job = await createBroadcastJob(svc.client, {
      gymId,
      title: body.title || "",
      body: body.body || "",
      url: body.url,
      scheduledAt: String(body.scheduledAt || ""),
      createdBy: body.createdBy || null,
    });
    return NextResponse.json({ ok: true, job });
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
        error: code || (err instanceof Error ? err.message : "create-failed"),
        message: err instanceof Error ? err.message : "create-failed",
      },
      { status },
    );
  }
}
