import { NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/member-portal/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const surface =
    new URL(req.url).searchParams.get("surface") === "member_portal" ? "member_portal" : "website";
  const base = String(process.env.GYM_MANAGER_API_URL || "https://app.gymactionplus.com").replace(/\/$/, "");
  let branchId = "";
  if (surface === "member_portal") {
    const session = await requireMemberSession();
    if (!session.ok) return NextResponse.json({ ok: true, active: false });
    branchId = String(session.member.assigned_gym_code_id || "");
  }
  try {
    const query = new URLSearchParams({ surface });
    if (branchId) query.set("branchId", branchId);
    const res = await fetch(`${base}/api/public/spin-wheel/config?${query.toString()}`, { cache: "no-store" });
    const payload = await res.json().catch(() => ({ ok: true, active: false }));
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ ok: true, active: false });
  }
}
