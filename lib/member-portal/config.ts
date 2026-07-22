import { GYM_ID } from "@/lib/config";

export const MEMBER_ACCESS_COOKIE = "apg_member_access";
export const MEMBER_REFRESH_COOKIE = "apg_member_refresh";
export const MEMBER_DEVICE_COOKIE = "apg_member_device";

export const MEMBER_ACCESS_TTL_SEC = Number(
  process.env.MEMBER_PORTAL_ACCESS_TTL_SEC || 30 * 60,
);
export const MEMBER_REFRESH_TTL_SEC = Number(
  process.env.MEMBER_PORTAL_REFRESH_TTL_SEC || 24 * 60 * 60,
);
/** Idle timeout — no activity for this long forces re-login (client + server). */
export const MEMBER_IDLE_TTL_SEC = Number(
  process.env.MEMBER_PORTAL_IDLE_TTL_SEC || 2 * 60 * 60,
);
export const MEMBER_OTP_TTL_SEC = Number(
  process.env.MEMBER_PORTAL_OTP_TTL_SEC || 10 * 60,
);
export const MEMBER_MAX_DEVICES = 3;
export const MEMBER_OTP_COOLDOWN_SEC = 45;
export const MEMBER_OTP_HOURLY_LIMIT = 8;

export const ALLOWED_MEMBER_STATUSES = new Set(["active", "hold"]);

export function portalGymId() {
  return GYM_ID;
}

export function memberJwtSecret() {
  return (
    process.env.MEMBER_PORTAL_JWT_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    "member-portal-dev-secret-change-me"
  );
}
