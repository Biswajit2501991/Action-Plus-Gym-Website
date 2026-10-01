import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";
import {
  authorizeInternalPushSecret,
  clampBroadcastBody,
  clampBroadcastTitle,
  runOwnerBroadcastTest,
} from "@/lib/member-portal/owner-broadcast";

export const dynamic = "force-dynamic";

/**
 * Owner-only test push to Bis Test.
 * Auth: Authorization: Bearer $MEMBER_PORTAL_CRON_SECRET
 * Does not send to other members and does not start the gym-wide cooldown.
 */
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

  const title = clampBroadcastTitle(body.title) || "Test notification";
  const message = clampBroadcastBody(body.body) || "This is a test for Bis Test only.";

  try {
    const result = await runOwnerBroadcastTest(svc.client, {
      gymId,
      title,
      body: message,
      url: typeof body.url === "string" ? body.url : "/members?inbox=1",
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
        error: code || (err instanceof Error ? err.message : "broadcast-test-failed"),
        message: err instanceof Error ? err.message : "broadcast-test-failed",
      },
      { status },
    );
  }
}
