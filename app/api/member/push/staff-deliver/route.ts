import { NextResponse } from "next/server";
import { authorizeInternalPushSecret } from "@/lib/member-portal/owner-broadcast";
import { deliverStaffPushes, type StaffPushItem } from "@/lib/member-portal/staff-push-deliver";

export const dynamic = "force-dynamic";

/**
 * Internal staff phone delivery (Gym Manager proxy).
 * Auth: Authorization: Bearer $MEMBER_PORTAL_CRON_SECRET
 * Does not write members, payments, or chat.
 */
export async function POST(req: Request) {
  if (!authorizeInternalPushSecret(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { items?: StaffPushItem[] } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const items = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  if (!items.length) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0, gone: [] });
  }

  try {
    const result = await deliverStaffPushes(items);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const status = err && typeof err === "object" && "status" in err
      ? Number((err as { status?: number }).status) || 500
      : 500;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "staff-push-failed" },
      { status },
    );
  }
}
