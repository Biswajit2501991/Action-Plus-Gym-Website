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

/**
 * Membership status gate for Member Portal.
 * Pass gym `portal_access_by_status` when available; otherwise defaults to Active/Hold only.
 * Does not touch PIN or home-tile settings.
 */
export function isPortalAllowedMembershipStatus(
  status: unknown,
  accessByStatus?: Record<string, boolean> | null,
): boolean {
  const statusLc = String(status || "").trim().toLowerCase();
  // Historical fail-safe when settings are missing/corrupt.
  if (!accessByStatus || typeof accessByStatus !== "object") {
    return ALLOWED_MEMBER_STATUSES.has(statusLc);
  }

  const map = { ...accessByStatus };
  const allOff =
    !map.Active &&
    !map.Hold &&
    !map.Deactivated &&
    !map.Cancelled &&
    !map.active &&
    !map.hold &&
    !map.deactivated &&
    !map.cancelled;
  if (allOff) {
    return ALLOWED_MEMBER_STATUSES.has(statusLc);
  }

  const key =
    statusLc === "active"
      ? "Active"
      : statusLc === "hold"
        ? "Hold"
        : statusLc === "deactivated"
          ? "Deactivated"
          : statusLc === "cancelled" || statusLc === "canceled"
            ? "Cancelled"
            : null;
  if (!key) return false;
  if (key in map) return Boolean(map[key]);
  const lower = key.toLowerCase();
  if (lower in map) return Boolean(map[lower]);
  // Unknown key shape → historical Active/Hold gate
  return ALLOWED_MEMBER_STATUSES.has(statusLc);
}

export const PORTAL_MEMBERSHIP_STATUS_ERROR =
  "Your membership status cannot use the Member Portal. Contact the gym.";

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
