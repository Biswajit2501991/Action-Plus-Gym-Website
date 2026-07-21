import { cookies } from "next/headers";
import {
  requireMemberSession,
  auditLog,
} from "@/lib/member-portal/session";
import { portalGymId } from "@/lib/member-portal/config";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { NextResponse } from "next/server";

function rpID() {
  const host = String(process.env.NEXT_PUBLIC_SITE_URL || "https://www.actionplusgym.com")
    .replace(/^https?:\/\//, "")
    .split("/")[0];
  return host || "www.actionplusgym.com";
}

function origin() {
  return String(process.env.NEXT_PUBLIC_SITE_URL || "https://www.actionplusgym.com").replace(
    /\/$/,
    "",
  );
}

/** Start WebAuthn registration (logged-in member). */
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

  const { data: existing } = await svc.client
    .from("member_portal_webauthn_credentials")
    .select("credential_id")
    .eq("gym_id", portalGymId())
    .eq("member_uuid", session.member.member_uuid);

  const options = await generateRegistrationOptions({
    rpName: "Action Plus Gym",
    rpID: rpID(),
    userName: session.member.member_code || session.member.mobile,
    userDisplayName: session.member.full_name,
    userID: new TextEncoder().encode(session.member.member_uuid),
    attestationType: "none",
    excludeCredentials: (existing || []).map((c) => ({
      id: c.credential_id,
      type: "public-key" as const,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      authenticatorAttachment: "platform",
    },
  });

  // stash challenge on member row via audit meta is weak — use challenge table-less cookie
  const jar = await cookies();
  jar.set("apg_webauthn_reg_challenge", options.challenge, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });

  return NextResponse.json({ ok: true, options });
}

export async function POST(req: Request) {
  const session = await requireMemberSession();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: session.error },
      { status: session.status },
    );
  }

  const jar = await cookies();
  const expectedChallenge = jar.get("apg_webauthn_reg_challenge")?.value;
  if (!expectedChallenge) {
    return NextResponse.json({ ok: false, error: "challenge-expired" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const verification = await verifyRegistrationResponse({
    response: body as never,
    expectedChallenge,
    expectedOrigin: origin(),
    expectedRPID: rpID(),
  });

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ ok: false, error: "verification-failed" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo as {
      credential: { id: string; publicKey: Uint8Array; counter: number };
      credentialDeviceType?: string;
      credentialBackedUp?: boolean;
    };

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
  }

  const publicKey = Buffer.from(credential.publicKey).toString("base64url");
  const { error } = await svc.client.from("member_portal_webauthn_credentials").upsert(
    {
      gym_id: portalGymId(),
      member_uuid: session.member.member_uuid,
      credential_id: credential.id,
      public_key: publicKey,
      counter: credential.counter,
      device_label: `${credentialDeviceType || "platform"}${credentialBackedUp ? "-backed-up" : ""}`,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "credential_id" },
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  jar.delete("apg_webauthn_reg_challenge");
  await auditLog({
    memberUuid: session.member.member_uuid,
    eventType: "webauthn_registered",
  });

  return NextResponse.json({ ok: true });
}
