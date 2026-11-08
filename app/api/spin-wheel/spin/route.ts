import { NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/member-portal/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { surface?: string; visitorKey?: string };
  const base = String(process.env.GYM_MANAGER_API_URL || "https://app.gymactionplus.com").replace(/\/$/, "");

  if (body.surface === "member_portal") {
    const session = await requireMemberSession();
    if (!session.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const secret = String(process.env.MEMBER_PORTAL_CRON_SECRET || "").trim();
    if (secret.length < 16) return NextResponse.json({ error: "spin-unavailable" }, { status: 503 });
    const res = await fetch(`${base}/api/internal/spin-wheel/spin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        memberUuid: session.member.member_uuid,
        memberCode: session.member.member_code,
        branchId: session.member.assigned_gym_code_id,
        planName: session.member.plan_name,
      }),
    });
    const payload = await res.json().catch(() => ({ error: "spin-failed" }));
    return NextResponse.json(payload, { status: res.status });
  }

  const visitorKey = String(body.visitorKey || "").trim();
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(visitorKey)) {
    return NextResponse.json({ error: "missing-person" }, { status: 400 });
  }
  const res = await fetch(`${base}/api/public/spin-wheel/spin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorKey }),
  });
  const payload = await res.json().catch(() => ({ error: "spin-failed" }));
  return NextResponse.json(payload, { status: res.status });
}
