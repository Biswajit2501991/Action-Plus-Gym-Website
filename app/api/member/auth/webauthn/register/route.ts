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
import {
  webauthnCookieSecure,
  webauthnExpectedOrigins,
  webauthnRpID,
} from "@/lib/member-portal/webauthn";

/** Start WebAuthn registration (logged-in member). */
export async function GET(req: Request) {
  try {
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

    const url = new URL(req.url);
    // local (default): platform fingerprint via GMS FIDO2 — avoids Android Credential Manager failures.
    // passkey: discoverable credential via Credential Manager (optional).
    const mode = String(url.searchParams.get("mode") || "local").trim().toLowerCase();
    const preferPasskey = mode === "passkey";

    const options = await generateRegistrationOptions({
      rpName: "Action Plus Gym",
      rpID: webauthnRpID(),
      userName: session.member.member_code || session.member.mobile,
      userDisplayName:
        session.member.full_name ||
        session.member.member_code ||
        session.member.mobile ||
        "Member",
      userID: new TextEncoder().encode(session.member.member_uuid),
      attestationType: "none",
      excludeCredentials: (existing || []).map((c) => ({
        id: c.credential_id,
      })),
      authenticatorSelection: preferPasskey
        ? {
            authenticatorAttachment: "platform",
            residentKey: "required",
            requireResidentKey: true,
            userVerification: "required",
          }
        : {
            // Local-only platform biometric. On Android Chrome this uses GMS FIDO2
            // instead of Credential Manager (which often throws NotReadableError).
            authenticatorAttachment: "platform",
            residentKey: "discouraged",
            requireResidentKey: false,
            userVerification: "required",
          },
      // Android Chrome + iOS Safari both handle ES256 / RS256
      supportedAlgorithmIDs: [-7, -257],
    });

    const jar = await cookies();
    jar.set("apg_webauthn_reg_challenge", options.challenge, {
      httpOnly: true,
      secure: webauthnCookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: 300,
    });

    return NextResponse.json({ ok: true, options });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not start biometric registration";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
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
      return NextResponse.json(
        { ok: false, error: "Registration timed out. Tap Register again." },
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body as never,
        expectedChallenge,
        expectedOrigin: webauthnExpectedOrigins(),
        expectedRPID: webauthnRpID(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Biometric verification failed";
      return NextResponse.json(
        {
          ok: false,
          error:
            /origin|rpId|challenge/i.test(msg)
              ? "Biometric could not be verified on this site. Open actionplusgym.com (or www) and try again."
              : msg,
        },
        { status: 400 },
      );
    }

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { ok: false, error: "Biometric verification failed. Try again." },
        { status: 400 },
      );
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Registration failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
