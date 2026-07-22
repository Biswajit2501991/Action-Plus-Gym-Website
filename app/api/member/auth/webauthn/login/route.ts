import { NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId, MEMBER_DEVICE_COOKIE } from "@/lib/member-portal/config";
import { findMemberByMobile, assertPortalEligible } from "@/lib/member-portal/members";
import { randomToken } from "@/lib/member-portal/crypto";
import { normalizeMobile } from "@/lib/member-portal/phone";
import { issueSession, auditLog, requestMeta } from "@/lib/member-portal/session";
import type { NextRequest } from "next/server";
import {
  webauthnCookieSecure,
  webauthnExpectedOrigins,
  webauthnRpID,
} from "@/lib/member-portal/webauthn";

/** Begin biometric login — body optional { mobile } to scope credentials. */
export async function POST(req: Request) {
  try {
    let mobile = "";
    let action = "options";
    let assertion: unknown = null;
    let deviceId = "";
    try {
      const json = await req.json();
      mobile = String(json?.mobile || "").trim();
      action = String(json?.action || "options").trim();
      assertion = json?.assertion || null;
      deviceId = String(json?.deviceId || "").trim();
    } catch {
      /* empty */
    }

    const svc = createServiceRoleClient();
    if (!svc.ok) {
      return NextResponse.json({ ok: false, error: svc.error }, { status: 500 });
    }

    if (action === "options") {
      const normalized = mobile ? normalizeMobile(mobile) : "";
      let credQuery = svc.client
        .from("member_portal_webauthn_credentials")
        .select("credential_id, member_uuid")
        .eq("gym_id", portalGymId());

      if (normalized) {
        const found = await findMemberByMobile(normalized);
        if (!found.ok) {
          return NextResponse.json({ ok: false, error: found.error }, { status: found.status });
        }
        credQuery = credQuery.eq("member_uuid", found.member.member_uuid);
      }

      const { data: creds } = await credQuery.limit(20);
      if (!creds?.length) {
        return NextResponse.json(
          {
            ok: false,
            error: "No Face ID / fingerprint registered on this membership yet.",
          },
          { status: 404 },
        );
      }

      const options = await generateAuthenticationOptions({
        rpID: webauthnRpID(),
        allowCredentials: creds.map((c) => ({
          id: c.credential_id,
        })),
        userVerification: "preferred",
      });

      const jar = await cookies();
      jar.set("apg_webauthn_auth_challenge", options.challenge, {
        httpOnly: true,
        secure: webauthnCookieSecure(),
        sameSite: "lax",
        path: "/",
        maxAge: 300,
      });
      jar.set(
        "apg_webauthn_auth_members",
        JSON.stringify([...new Set(creds.map((c) => c.member_uuid))]),
        {
          httpOnly: true,
          secure: webauthnCookieSecure(),
          sameSite: "lax",
          path: "/",
          maxAge: 300,
        },
      );

      return NextResponse.json({ ok: true, options });
    }

    // verify
    const jar = await cookies();
    const expectedChallenge = jar.get("apg_webauthn_auth_challenge")?.value;
    if (!expectedChallenge || !assertion) {
      return NextResponse.json(
        { ok: false, error: "Biometric login timed out. Try again." },
        { status: 400 },
      );
    }

    const credId = String((assertion as { id?: string })?.id || "");
    const { data: stored } = await svc.client
      .from("member_portal_webauthn_credentials")
      .select("*")
      .eq("gym_id", portalGymId())
      .eq("credential_id", credId)
      .maybeSingle();

    if (!stored) {
      return NextResponse.json(
        { ok: false, error: "Unknown biometric. Register again while signed in." },
        { status: 404 },
      );
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: assertion as never,
        expectedChallenge,
        expectedOrigin: webauthnExpectedOrigins(),
        expectedRPID: webauthnRpID(),
        credential: {
          id: stored.credential_id,
          publicKey: Buffer.from(stored.public_key, "base64url"),
          counter: Number(stored.counter || 0),
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Biometric login failed";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    if (!verification.verified) {
      return NextResponse.json(
        { ok: false, error: "Biometric verification failed." },
        { status: 401 },
      );
    }

    const { data: member } = await svc.client
      .from("members")
      .select("*")
      .eq("gym_id", portalGymId())
      .eq("member_uuid", stored.member_uuid)
      .is("deleted_at", null)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ ok: false, error: "member-not-found" }, { status: 404 });
    }

    const eligible = assertPortalEligible(member);
    if (!eligible.ok) {
      return NextResponse.json(
        { ok: false, error: eligible.error },
        { status: eligible.status },
      );
    }

    await svc.client
      .from("member_portal_webauthn_credentials")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", stored.id);

    const jarDevice =
      deviceId || (await cookies()).get(MEMBER_DEVICE_COOKIE)?.value || randomToken(16);
    const { ip, userAgent } = requestMeta(req as NextRequest);
    const session = await issueSession({
      member,
      deviceId: jarDevice,
      deviceLabel: "Biometric device",
      ip,
      userAgent,
    });
    if (!session.ok) {
      return NextResponse.json({ ok: false, error: session.error }, { status: session.status });
    }

    jar.delete("apg_webauthn_auth_challenge");
    jar.delete("apg_webauthn_auth_members");

    await auditLog({
      memberUuid: member.member_uuid,
      eventType: "webauthn_login",
      ip,
      userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Biometric login failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
