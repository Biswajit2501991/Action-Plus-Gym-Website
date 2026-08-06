import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMemberSession, auditLog } from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";
import {
  configureWebPush,
  sendPushToSubscription,
} from "@/lib/member-portal/billing-push";

export async function POST(req: Request) {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  let body: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    userAgent?: string;
    /** When true, send a one-shot confirmation so the member can verify closed-app push. */
    confirm?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const endpoint = String(body.endpoint || "").trim();
  const p256dh = String(body.keys?.p256dh || "").trim();
  const auth = String(body.keys?.auth || "").trim();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { ok: false, error: "subscription-required" },
      { status: 400 },
    );
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const gymId = portalGymId();
  const { error } = await svc.client.from("member_portal_push_subscriptions").upsert(
    {
      gym_id: gymId,
      member_uuid: session.member.member_uuid,
      endpoint,
      p256dh,
      auth,
      user_agent: String(body.userAgent || "").slice(0, 300) || null,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await auditLog({
    memberUuid: session.member.member_uuid,
    eventType: "push_subscribed",
  });

  let confirmed = false;
  if (body.confirm) {
    const vapid = configureWebPush();
    if (vapid.ok) {
      confirmed = await sendPushToSubscription(svc.client, {
        gymId,
        memberUuid: session.member.member_uuid,
        sub: { endpoint, p256dh, auth },
        title: "Reminders enabled",
        body: "You'll get a billing-day reminder on this phone even when Member Portal is closed.",
        url: "/members",
        kind: "push_confirm",
        tag: "push-confirm",
        log: true,
      });
    }
  }

  return NextResponse.json({ ok: true, confirmed });
}

export async function DELETE(req: Request) {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  let endpoint = "";
  try {
    const body = await req.json();
    endpoint = String(body?.endpoint || "").trim();
  } catch {
    endpoint = "";
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  let q = svc.client
    .from("member_portal_push_subscriptions")
    .delete()
    .eq("gym_id", portalGymId())
    .eq("member_uuid", session.member.member_uuid);
  if (endpoint) q = q.eq("endpoint", endpoint);
  await q;

  return NextResponse.json({ ok: true });
}
