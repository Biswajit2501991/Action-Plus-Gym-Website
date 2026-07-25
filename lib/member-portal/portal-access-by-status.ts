import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalGymId } from "@/lib/member-portal/config";

export type PortalAccessStatusKey = "Active" | "Hold" | "Deactivated" | "Cancelled";
export type PortalAccessByStatus = Record<PortalAccessStatusKey, boolean>;

/** Matches historical portal gate: Active + Hold only. */
export const DEFAULT_PORTAL_ACCESS_BY_STATUS: PortalAccessByStatus = {
  Active: true,
  Hold: true,
  Deactivated: false,
  Cancelled: false,
};

export function normalizePortalAccessByStatus(input: unknown): PortalAccessByStatus {
  const src =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const out: PortalAccessByStatus = { ...DEFAULT_PORTAL_ACCESS_BY_STATUS };
  for (const key of Object.keys(DEFAULT_PORTAL_ACCESS_BY_STATUS) as PortalAccessStatusKey[]) {
    const lower = key.toLowerCase();
    if (key in src) out[key] = Boolean(src[key]);
    else if (lower in src) out[key] = Boolean(src[lower]);
  }
  return out;
}

export function canonicalMemberStatus(status: unknown): PortalAccessStatusKey | null {
  const raw = String(status || "").trim().toLowerCase();
  if (raw === "active") return "Active";
  if (raw === "hold") return "Hold";
  if (raw === "deactivated") return "Deactivated";
  if (raw === "cancelled" || raw === "canceled") return "Cancelled";
  return null;
}

let cached: { at: number; value: PortalAccessByStatus } | null = null;
const CACHE_MS = 30_000;

export async function loadPortalAccessByStatus(): Promise<PortalAccessByStatus> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.value;

  const svc = createServiceRoleClient();
  if (!svc.ok) {
    cached = { at: now, value: DEFAULT_PORTAL_ACCESS_BY_STATUS };
    return cached.value;
  }
  try {
    const { data } = await svc.client
      .from("member_portal_settings")
      .select("portal_access_by_status")
      .eq("gym_id", portalGymId())
      .maybeSingle();
    const value = normalizePortalAccessByStatus(data?.portal_access_by_status);
    cached = { at: now, value };
    return value;
  } catch {
    cached = { at: now, value: DEFAULT_PORTAL_ACCESS_BY_STATUS };
    return cached.value;
  }
}

export function isPortalAccessAllowedForStatus(
  status: unknown,
  accessByStatus?: PortalAccessByStatus | null,
): boolean {
  const key = canonicalMemberStatus(status);
  if (!key) return false;
  const map = normalizePortalAccessByStatus(accessByStatus);
  return map[key] === true;
}
