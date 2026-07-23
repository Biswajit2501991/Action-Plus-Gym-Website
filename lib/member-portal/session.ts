import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  MEMBER_ACCESS_COOKIE,
  MEMBER_DEVICE_COOKIE,
  MEMBER_REFRESH_COOKIE,
  MEMBER_ACCESS_TTL_SEC,
  MEMBER_REFRESH_TTL_SEC,
  MEMBER_IDLE_TTL_SEC,
  MEMBER_MAX_DEVICES,
  portalGymId,
} from "@/lib/member-portal/config";
import { randomToken, sha256 } from "@/lib/member-portal/crypto";
import { signMemberAccess, verifyMemberAccess } from "@/lib/member-portal/jwt";

export type MemberRow = {
  id: number;
  gym_id: string;
  member_uuid: string;
  member_code: string;
  full_name: string;
  mobile: string;
  email: string | null;
  dob: string | null;
  status: string;
  plan_name: string | null;
  amount: number | null;
  joining_date: string | null;
  billing_date: string | null;
  next_payment_date: string | null;
  payment_by: string | null;
  assigned_gym_code_id: string | null;
  photo_url: string | null;
  photo_path: string | null;
  parent_guardian_name: string | null;
  medical_answers_json: Record<string, unknown> | null;
  portal_enabled: boolean;
  portal_status: string;
  qr_token: string;
  pin_hash: string | null;
  portal_activated_at: string | null;
  last_portal_login_at: string | null;
  deleted_at: string | null;
};

export function requestMeta(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";
  const userAgent = req.headers.get("user-agent") || "";
  return { ip, userAgent };
}

export async function auditLog(input: {
  memberUuid?: string | null;
  eventType: string;
  meta?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}) {
  const svc = createServiceRoleClient();
  if (!svc.ok) return;
  await svc.client.from("member_portal_audit_logs").insert({
    gym_id: portalGymId(),
    member_uuid: input.memberUuid || null,
    event_type: input.eventType,
    meta: input.meta || {},
    ip: input.ip || null,
    user_agent: input.userAgent || null,
  });
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function setAuthCookies(input: {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
}) {
  const jar = await cookies();
  jar.set(MEMBER_ACCESS_COOKIE, input.accessToken, cookieOptions(MEMBER_ACCESS_TTL_SEC));
  jar.set(
    MEMBER_REFRESH_COOKIE,
    input.refreshToken,
    cookieOptions(MEMBER_REFRESH_TTL_SEC),
  );
  jar.set(
    MEMBER_DEVICE_COOKIE,
    input.deviceId,
    cookieOptions(MEMBER_REFRESH_TTL_SEC * 30),
  );
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(MEMBER_ACCESS_COOKIE);
  jar.delete(MEMBER_REFRESH_COOKIE);
  jar.delete(MEMBER_DEVICE_COOKIE);
}

export async function issueSession(input: {
  member: MemberRow;
  deviceId: string;
  deviceLabel?: string;
  ip?: string;
  userAgent?: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const svc = createServiceRoleClient();
  if (!svc.ok) return { ok: false, error: svc.error, status: 500 };

  const gymId = portalGymId();
  const memberUuid = input.member.member_uuid;
  const deviceId = String(input.deviceId || "").trim() || randomToken(16);

  const { data: devices, error: devicesErr } = await svc.client
    .from("member_portal_devices")
    .select("id, device_id, revoked_at, last_seen_at, created_at")
    .eq("member_uuid", memberUuid);

  if (devicesErr) {
    console.error(devicesErr);
    return { ok: false, error: "Could not load devices", status: 500 };
  }

  const allDevices = devices || [];
  const active = allDevices.filter((d) => !d.revoked_at);
  // Include revoked rows — unique (member_uuid, device_id) still applies, so re-login
  // must reactivate rather than insert a duplicate.
  const existing = allDevices.find((d) => d.device_id === deviceId);
  const wouldAddActiveSlot = !existing || Boolean(existing.revoked_at);

  // Soft-cap: when a new/reactivated device would exceed the limit, silently
  // revoke the oldest other device(s) by last activity so login stays seamless.
  if (wouldAddActiveSlot && active.length >= MEMBER_MAX_DEVICES) {
    const keepSlots = MEMBER_MAX_DEVICES - 1;
    const evicted = await revokeOldestActiveDevices({
      client: svc.client,
      memberUuid,
      activeDevices: active.filter((d) => d.device_id !== deviceId),
      keepCount: keepSlots,
    });
    if (evicted.length) {
      await auditLog({
        memberUuid,
        eventType: "device_auto_evicted",
        meta: {
          reason: "max_devices",
          maxDevices: MEMBER_MAX_DEVICES,
          newDeviceId: deviceId,
          evictedDeviceIds: evicted.map((d) => d.device_id),
        },
        ip: input.ip,
        userAgent: input.userAgent,
      });
    }
  }

  const refreshToken = randomToken(32);
  const refreshHash = sha256(refreshToken);
  const expiresAt = new Date(
    Date.now() + MEMBER_REFRESH_TTL_SEC * 1000,
  ).toISOString();

  if (existing) {
    const { error: updDevErr } = await svc.client
      .from("member_portal_devices")
      .update({
        last_seen_at: new Date().toISOString(),
        refresh_token_hash: refreshHash,
        label: input.deviceLabel || undefined,
        trusted: true,
        revoked_at: null,
      })
      .eq("id", existing.id);
    if (updDevErr) {
      console.error(updDevErr);
      return { ok: false, error: "Could not register device", status: 500 };
    }
  } else {
    const { error: insDevErr } = await svc.client.from("member_portal_devices").insert({
      gym_id: gymId,
      member_uuid: memberUuid,
      device_id: deviceId,
      label: input.deviceLabel || guessDeviceLabel(input.userAgent),
      trusted: true,
      refresh_token_hash: refreshHash,
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    });
    if (insDevErr) {
      // Race: another request may have inserted the same device_id — reactivate it.
      if (String(insDevErr.code || "") === "23505" || /duplicate key/i.test(String(insDevErr.message || ""))) {
        const { error: raceErr } = await svc.client
          .from("member_portal_devices")
          .update({
            last_seen_at: new Date().toISOString(),
            refresh_token_hash: refreshHash,
            label: input.deviceLabel || guessDeviceLabel(input.userAgent),
            trusted: true,
            revoked_at: null,
          })
          .eq("member_uuid", memberUuid)
          .eq("device_id", deviceId);
        if (raceErr) {
          console.error(insDevErr, raceErr);
          return { ok: false, error: "Could not register device", status: 500 };
        }
      } else {
        console.error(insDevErr);
        return { ok: false, error: "Could not register device", status: 500 };
      }
    }
  }

  // Revoke prior sessions for this device
  await svc.client
    .from("member_portal_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("member_uuid", memberUuid)
    .eq("device_id", deviceId)
    .is("revoked_at", null);

  const { data: session, error: sessErr } = await svc.client
    .from("member_portal_sessions")
    .insert({
      gym_id: gymId,
      member_uuid: memberUuid,
      device_id: deviceId,
      refresh_token_hash: refreshHash,
      expires_at: expiresAt,
      last_used_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (sessErr || !session) {
    console.error(sessErr);
    return { ok: false, error: "Could not create session", status: 500 };
  }

  const accessToken = signMemberAccess({
    mid: memberUuid,
    did: deviceId,
    sid: session.id,
    gid: gymId,
  });

  await svc.client
    .from("members")
    .update({
      last_portal_login_at: new Date().toISOString(),
      portal_status:
        input.member.portal_status === "disabled" ? "disabled" : "active",
      portal_activated_at:
        input.member.portal_activated_at || new Date().toISOString(),
      portal_enabled: true,
    })
    .eq("member_uuid", memberUuid);

  await setAuthCookies({ accessToken, refreshToken, deviceId });
  await auditLog({
    memberUuid,
    eventType: "login",
    meta: { deviceId },
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return { ok: true };
}

type DeviceRowLite = {
  id: string;
  device_id: string;
  last_seen_at?: string | null;
  created_at?: string | null;
};

/** Soft-revoke oldest active devices until `keepCount` remain. Does not delete rows. */
async function revokeOldestActiveDevices(input: {
  client: SupabaseClient;
  memberUuid: string;
  activeDevices: DeviceRowLite[];
  keepCount: number;
}): Promise<DeviceRowLite[]> {
  const overflow = input.activeDevices.length - input.keepCount;
  if (overflow <= 0) return [];

  const sorted = [...input.activeDevices].sort((a, b) => {
    const aT = Date.parse(String(a.last_seen_at || a.created_at || "")) || 0;
    const bT = Date.parse(String(b.last_seen_at || b.created_at || "")) || 0;
    return aT - bT;
  });
  const toRevoke = sorted.slice(0, overflow);
  const now = new Date().toISOString();

  for (const device of toRevoke) {
    await input.client
      .from("member_portal_devices")
      .update({ revoked_at: now })
      .eq("id", device.id)
      .eq("member_uuid", input.memberUuid)
      .is("revoked_at", null);

    await input.client
      .from("member_portal_sessions")
      .update({ revoked_at: now })
      .eq("member_uuid", input.memberUuid)
      .eq("device_id", device.device_id)
      .is("revoked_at", null);
  }

  return toRevoke;
}

function guessDeviceLabel(ua?: string) {
  const s = String(ua || "");
  if (/iPhone/i.test(s)) return "iPhone";
  if (/iPad/i.test(s)) return "iPad";
  if (/Android/i.test(s)) return "Android";
  if (/Mac OS/i.test(s)) return "Mac";
  if (/Windows/i.test(s)) return "Windows";
  return "Device";
}

export async function requireMemberSession(): Promise<
  | { ok: true; claims: NonNullable<ReturnType<typeof verifyMemberAccess>>; member: MemberRow }
  | { ok: false; error: string; status: number }
> {
  const jar = await cookies();
  const access = jar.get(MEMBER_ACCESS_COOKIE)?.value;
  const claims = access ? verifyMemberAccess(access) : null;

  if (!claims) {
    // Try refresh
    const refreshed = await refreshFromCookies();
    if (!refreshed.ok) return refreshed;
    return requireMemberSessionAfterRefresh();
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) return { ok: false, error: svc.error, status: 500 };

  const { data: session } = await svc.client
    .from("member_portal_sessions")
    .select("id, revoked_at, expires_at, last_used_at")
    .eq("id", claims.sid)
    .maybeSingle();

  if (
    !session ||
    session.revoked_at ||
    new Date(session.expires_at).getTime() < Date.now()
  ) {
    await clearAuthCookies();
    return { ok: false, error: "Session expired", status: 401 };
  }

  const lastUsedMs = Date.parse(String(session.last_used_at || "")) || 0;
  if (lastUsedMs > 0 && Date.now() - lastUsedMs > MEMBER_IDLE_TTL_SEC * 1000) {
    await svc.client
      .from("member_portal_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", session.id);
    await clearAuthCookies();
    return {
      ok: false,
      error: "Signed out after 2 hours of inactivity. Please sign in again.",
      status: 401,
    };
  }

  // Refresh idle clock (throttled: only if older than 2 minutes).
  if (!lastUsedMs || Date.now() - lastUsedMs > 120_000) {
    void svc.client
      .from("member_portal_sessions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", session.id);
  }

  const { data: member } = await svc.client
    .from("members")
    .select(
      "id, gym_id, member_uuid, member_code, full_name, mobile, email, dob, status, plan_name, amount, joining_date, billing_date, next_payment_date, payment_by, assigned_gym_code_id, photo_url, photo_path, parent_guardian_name, medical_answers_json, portal_enabled, portal_status, qr_token, pin_hash, portal_activated_at, last_portal_login_at, deleted_at",
    )
    .eq("member_uuid", claims.mid)
    .eq("gym_id", portalGymId())
    .is("deleted_at", null)
    .maybeSingle();

  if (!member || !member.portal_enabled || member.portal_status === "disabled") {
    await clearAuthCookies();
    return { ok: false, error: "Portal access disabled", status: 403 };
  }
  if (member.portal_status === "revoked") {
    await clearAuthCookies();
    return {
      ok: false,
      error: "Access revoked. Please verify via WhatsApp again.",
      status: 401,
    };
  }

  return { ok: true, claims, member: member as MemberRow };
}

async function requireMemberSessionAfterRefresh() {
  const jar = await cookies();
  const access = jar.get(MEMBER_ACCESS_COOKIE)?.value;
  const claims = access ? verifyMemberAccess(access) : null;
  if (!claims) return { ok: false as const, error: "Unauthorized", status: 401 };

  const svc = createServiceRoleClient();
  if (!svc.ok) return { ok: false as const, error: svc.error, status: 500 };

  const { data: member } = await svc.client
    .from("members")
    .select(
      "id, gym_id, member_uuid, member_code, full_name, mobile, email, dob, status, plan_name, amount, joining_date, billing_date, next_payment_date, payment_by, assigned_gym_code_id, photo_url, photo_path, parent_guardian_name, medical_answers_json, portal_enabled, portal_status, qr_token, pin_hash, portal_activated_at, last_portal_login_at, deleted_at",
    )
    .eq("member_uuid", claims.mid)
    .eq("gym_id", portalGymId())
    .is("deleted_at", null)
    .maybeSingle();

  if (!member) return { ok: false as const, error: "Unauthorized", status: 401 };
  return { ok: true as const, claims, member: member as MemberRow };
}

async function refreshFromCookies(): Promise<
  { ok: true } | { ok: false; error: string; status: number }
> {
  const jar = await cookies();
  const refresh = jar.get(MEMBER_REFRESH_COOKIE)?.value;
  const deviceId = jar.get(MEMBER_DEVICE_COOKIE)?.value;
  if (!refresh || !deviceId) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  const svc = createServiceRoleClient();
  if (!svc.ok) return { ok: false, error: svc.error, status: 500 };

  const hash = sha256(refresh);
  const { data: session } = await svc.client
    .from("member_portal_sessions")
    .select("id, member_uuid, device_id, expires_at, revoked_at, last_used_at")
    .eq("refresh_token_hash", hash)
    .eq("device_id", deviceId)
    .is("revoked_at", null)
    .maybeSingle();

  if (
    !session ||
    new Date(session.expires_at).getTime() < Date.now()
  ) {
    await clearAuthCookies();
    return { ok: false, error: "Session expired", status: 401 };
  }

  // Idle logout: no activity for MEMBER_IDLE_TTL_SEC (default 2 hours).
  const lastUsedMs = Date.parse(String(session.last_used_at || "")) || 0;
  if (lastUsedMs > 0 && Date.now() - lastUsedMs > MEMBER_IDLE_TTL_SEC * 1000) {
    await svc.client
      .from("member_portal_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", session.id);
    await clearAuthCookies();
    return {
      ok: false,
      error: "Signed out after 2 hours of inactivity. Please sign in again.",
      status: 401,
    };
  }

  const { data: member } = await svc.client
    .from("members")
    .select(
      "id, gym_id, member_uuid, member_code, full_name, mobile, email, dob, status, plan_name, amount, joining_date, billing_date, next_payment_date, payment_by, assigned_gym_code_id, photo_url, photo_path, parent_guardian_name, medical_answers_json, portal_enabled, portal_status, qr_token, pin_hash, portal_activated_at, last_portal_login_at, deleted_at",
    )
    .eq("member_uuid", session.member_uuid)
    .eq("gym_id", portalGymId())
    .is("deleted_at", null)
    .maybeSingle();

  if (!member || !member.portal_enabled || member.portal_status === "disabled") {
    await clearAuthCookies();
    return { ok: false, error: "Portal access disabled", status: 403 };
  }
  if (member.portal_status === "revoked") {
    await clearAuthCookies();
    return {
      ok: false,
      error: "Access revoked. Please verify via WhatsApp again.",
      status: 401,
    };
  }

  const newRefresh = randomToken(32);
  const newHash = sha256(newRefresh);
  const expiresAt = new Date(
    Date.now() + MEMBER_REFRESH_TTL_SEC * 1000,
  ).toISOString();

  await svc.client
    .from("member_portal_sessions")
    .update({
      refresh_token_hash: newHash,
      expires_at: expiresAt,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  await svc.client
    .from("member_portal_devices")
    .update({
      refresh_token_hash: newHash,
      last_seen_at: new Date().toISOString(),
    })
    .eq("member_uuid", member.member_uuid)
    .eq("device_id", deviceId)
    .is("revoked_at", null);

  const accessToken = signMemberAccess({
    mid: member.member_uuid,
    did: deviceId,
    sid: session.id,
    gid: portalGymId(),
  });

  await setAuthCookies({
    accessToken,
    refreshToken: newRefresh,
    deviceId,
  });

  return { ok: true };
}
